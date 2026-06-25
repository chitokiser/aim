"""Admin commands: /newtreasure (ConversationHandler)."""

import logging
from datetime import datetime
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes, ConversationHandler
from telegram.constants import ParseMode

from config import ADMIN_IDS, BROADCAST_GROUP_IDS, GROUP_CHAT_ID, COMMUNITY_URL, JUMPWORLD_URL
from database import create_treasure, save_questions, get_treasure, get_lang
from services.ai_service import reverse_geocode, generate_questions, build_coordinate_clues
from utils.i18n import t

logger = logging.getLogger(__name__)

# ConversationHandler states
ASK_COORDS = 0
ASK_PRIZE = 1
ASK_DESC = 2


def _is_admin(user_id: int) -> bool:
    return user_id in ADMIN_IDS


# ── Entry point ───────────────────────────────────────────────────────────────

async def cmd_newtreasure(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message or not update.effective_user:
        return ConversationHandler.END
    if not _is_admin(update.effective_user.id):
        lang = await get_lang(update.effective_user.id)
        await update.message.reply_text(t("admin_only", lang))
        return ConversationHandler.END

    lang = await get_lang(update.effective_user.id)
    await update.message.reply_text(t("ask_coords", lang), parse_mode=ParseMode.MARKDOWN)
    return ASK_COORDS


# ── Step 1: Coordinates ───────────────────────────────────────────────────────

async def handle_coords(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message or not update.effective_user:
        return ConversationHandler.END

    lang = await get_lang(update.effective_user.id)
    text = (update.message.text or "").strip()
    parts = text.replace(",", " ").split()
    if len(parts) < 2:
        await update.message.reply_text(t("invalid_coords_format", lang), parse_mode=ParseMode.MARKDOWN)
        return ASK_COORDS

    try:
        lat = float(parts[0])
        lon = float(parts[1])
    except ValueError:
        await update.message.reply_text(t("invalid_coords_format", lang), parse_mode=ParseMode.MARKDOWN)
        return ASK_COORDS

    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        await update.message.reply_text(t("invalid_coords_range", lang))
        return ASK_COORDS

    context.user_data["lat"] = lat
    context.user_data["lon"] = lon

    await update.message.reply_text(
        t("coords_confirmed", lang, lat=lat, lon=lon),
        parse_mode=ParseMode.MARKDOWN,
    )
    return ASK_PRIZE


# ── Step 2: Prize amount ──────────────────────────────────────────────────────

async def handle_prize(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message or not update.effective_user:
        return ConversationHandler.END

    lang = await get_lang(update.effective_user.id)
    text = (update.message.text or "").strip().replace(",", "")
    try:
        prize = int(text)
        if prize <= 0:
            raise ValueError
    except ValueError:
        await update.message.reply_text(t("invalid_prize", lang), parse_mode=ParseMode.MARKDOWN)
        return ASK_PRIZE

    context.user_data["prize"] = prize
    await update.message.reply_text(
        t("prize_confirmed", lang, prize=prize),
        parse_mode=ParseMode.MARKDOWN,
    )
    return ASK_DESC


# ── Step 3: Description → Generate & Create ───────────────────────────────────

async def handle_desc(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message or not update.effective_user:
        return ConversationHandler.END

    lang = await get_lang(update.effective_user.id)
    text = (update.message.text or "").strip()
    description = "" if text == "-" else text

    lat: float = context.user_data.get("lat", 0.0)
    lon: float = context.user_data.get("lon", 0.0)
    prize: int = context.user_data.get("prize", 0)
    admin_id = update.effective_user.id

    progress_msg = await update.message.reply_text(t("generating", lang))

    try:
        geo = await reverse_geocode(lat, lon)
        location_name = geo.get("display_name", f"{lat:.4f}, {lon:.4f}")

        questions = await generate_questions(lat, lon, geo)
        if len(questions) < 5:
            await progress_msg.edit_text(t("ai_failed", lang))
            return ConversationHandler.END

        while len(questions) < 10:
            questions.append(questions[-1])
        questions = questions[:10]

        treasure = await create_treasure(
            latitude=lat,
            longitude=lon,
            location_name=location_name[:500],
            prize_gp=prize,
            prize_description=description[:500],
            created_by=admin_id,
            group_chat_id=GROUP_CHAT_ID,
        )

        await save_questions(treasure.id, questions)

        await progress_msg.edit_text(
            t("treasure_created_progress", lang,
              id=treasure.id, location=location_name[:100],
              prize=prize, count=len(questions))
        )

        bot_username = context.bot_data.get("username", "")
        await _announce_in_group(context, treasure, len(questions), bot_username)

        await progress_msg.edit_text(
            t("treasure_created_ok", lang,
              id=treasure.id, location=location_name[:100],
              prize=prize, count=len(questions))
        )

    except Exception as e:
        logger.exception("Failed to create treasure: %s", e)
        await progress_msg.edit_text(t("create_error", lang, error=e))

    context.user_data.clear()
    return ConversationHandler.END


async def _announce_in_group(context: ContextTypes.DEFAULT_TYPE, treasure, q_count: int, bot_username: str) -> None:
    if not BROADCAST_GROUP_IDS:
        logger.warning("No group IDs configured — skipping group announcement")
        return

    deeplink = f"https://t.me/{bot_username}?start=treasure_{treasure.id}" if bot_username else ""
    text = (
        f"🗺 *새로운 보물이 등장했습니다!* 🎉\n\n"
        f"🔢 보물 번호: *#{treasure.id}*\n"
        f"🎁 상금: *{treasure.prize_gp:,} P*\n"
        f"📋 총 {q_count}문제 (AI 생성)\n\n"
        f"📝 {treasure.prize_description or '보물의 정확한 위치를 찾아보세요!'}\n\n"
        f"⚠️ 3번 오답 시 도전 불가!\n"
        f"💡 힌트 구매 가능 (P 필요)\n"
        f"🔒 좌표는 문제를 풀어야 공개됩니다!"
    )

    keyboard_buttons = []
    if deeplink:
        keyboard_buttons.append(InlineKeyboardButton("🎯 도전하기", url=deeplink))
    keyboard_buttons.append(InlineKeyboardButton("🏪 Jumpworld", url=JUMPWORLD_URL))
    keyboard_buttons.append(InlineKeyboardButton("💬 AIM 커뮤니티", url=COMMUNITY_URL))

    keyboard = InlineKeyboardMarkup([
        keyboard_buttons[:2],
        [keyboard_buttons[2]] if len(keyboard_buttons) > 2 else [],
    ])

    for gid in BROADCAST_GROUP_IDS:
        try:
            await context.bot.send_message(
                chat_id=gid,
                text=text,
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=keyboard,
            )
        except Exception as e:
            logger.error("Failed to send group announcement to %s: %s", gid, e)

    tg_username = context.bot_data.get("username", "AITreasureHuntBot")
    bot_url = f"https://t.me/{tg_username}?start=treasure_{treasure.id}" if tg_username else ""

    # Plain text for Threads (text-only API — URLs are auto-linked by the platform)
    tweet = (
        f"🗺 New Treasure Hunt! / 새 보물 등장!\n\n"
        f"🔢 #{treasure.id}  🎁 {treasure.prize_gp:,} P\n"
        f"📋 {q_count} questions (AI generated)\n\n"
        f"👉 {bot_url}\n"
        f"💬 https://t.me/ai119link"
    )

    post_title = f"🗺 New Treasure Hunt #{treasure.id} — {treasure.prize_gp:,} P Prize!"

    from services.threads import post_threads
    from services.blogger import post_blogger
    from services.tumblr import post_tumblr
    await post_threads(tweet)
    await post_blogger(post_title, _build_html_post(treasure, q_count, bot_url), is_html=True)
    await post_tumblr(post_title, _build_html_post(treasure, q_count, bot_url), is_html=True)


_BTN_STYLE = (
    "display:inline-block;padding:10px 20px;margin:4px 2px;border-radius:6px;"
    "background:#2563eb;color:#fff;text-decoration:none;font-weight:bold;font-size:15px;"
)
_BTN_STYLE_GREEN = _BTN_STYLE.replace("#2563eb", "#16a34a")


def _build_html_post(treasure, q_count: int, bot_url: str) -> str:
    """Build an HTML body for Blogger/Tumblr with clickable button links."""
    play_btn = (
        f'<a href="{bot_url}" style="{_BTN_STYLE}">🎯 Play Now / 도전하기</a>'
        if bot_url else ""
    )
    community_btn = (
        f'<a href="https://t.me/ai119link" style="{_BTN_STYLE_GREEN}">💬 Join AIM Community</a>'
    )
    desc = treasure.prize_description or "Find the exact location of the treasure!"
    return (
        f"<h2>🗺 New Treasure Hunt #{treasure.id}</h2>"
        f"<p>🎁 Prize: <strong>{treasure.prize_gp:,} P</strong></p>"
        f"<p>📋 {q_count} questions (AI generated)</p>"
        f"<p>📝 {desc}</p>"
        f"<p>⚠️ 3 wrong answers = challenge locked<br>"
        f"💡 Hints available (costs P)<br>"
        f"🔒 Coordinates revealed only after solving</p>"
        f"<p>{play_btn}&nbsp;&nbsp;{community_btn}</p>"
    )


# ── Cancel ────────────────────────────────────────────────────────────────────

async def handle_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.message and update.effective_user:
        lang = await get_lang(update.effective_user.id)
        await update.message.reply_text(t("cancelled", lang))
    context.user_data.clear()
    return ConversationHandler.END


# ── Admin stats ───────────────────────────────────────────────────────────────

async def cmd_admin(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not update.effective_user:
        return
    if not _is_admin(update.effective_user.id):
        lang = await get_lang(update.effective_user.id)
        await update.message.reply_text(t("admin_only", lang))
        return

    lang = await get_lang(update.effective_user.id)

    from database import get_stats

    stats = await get_stats()

    await update.message.reply_text(
        t("admin_panel", lang,
          total=stats["total_treasures"], active=stats["active_treasures"],
          players=stats["total_players"], attempts=stats["total_attempts"],
          completions=stats["completions"]),
        parse_mode=ParseMode.MARKDOWN,
    )
