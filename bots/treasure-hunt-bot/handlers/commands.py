"""Public commands: /start, /treasures, /gp."""

import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from telegram.constants import ParseMode

from config import COMMUNITY_URL, JUMPWORLD_URL, STARTING_GP
from database import get_active_treasures, get_attempt, get_gp
from utils.keyboards import main_menu_keyboard, treasure_list_keyboard, treasure_info_keyboard

logger = logging.getLogger(__name__)


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return

    user = update.effective_user
    username = user.username if user else None

    # Deep-link: /start treasure_<id>
    if context.args and context.args[0].startswith("treasure_"):
        try:
            treasure_id = int(context.args[0].split("_", 1)[1])
            await _show_treasure_info(update, context, user.id, username, treasure_id)
            return
        except (ValueError, IndexError):
            pass

    # Ensure GP record exists for new users
    await get_gp(user.id if user else 0, username)

    text = (
        "🗺 *AI 보물찾기 게임에 오신 걸 환영합니다!*\n\n"
        "운영자가 숨겨놓은 보물의 좌표를 찾아보세요.\n"
        "AI가 만든 10개의 문제를 맞히면 정확한 좌표가 공개됩니다!\n\n"
        f"🎁 신규 참가자에게 *{STARTING_GP:,} GP* 지급!\n"
        "💡 힌트: Lv1=100 GP / Lv2=300 GP / Lv3=500 GP\n"
        "⚠️ 3번 오답 시 해당 보물 도전 불가\n\n"
        "아래 버튼으로 시작하세요 👇"
    )
    await update.message.reply_text(text, parse_mode=ParseMode.MARKDOWN, reply_markup=main_menu_keyboard())


async def cmd_treasures(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return
    user = update.effective_user
    if not user:
        return

    treasures = await get_active_treasures(user.id)
    if not treasures:
        await update.message.reply_text(
            "현재 도전할 수 있는 보물이 없습니다.\n곧 새로운 보물이 등장할 예정입니다! 🗺",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("🏪 Jumpworld", url=JUMPWORLD_URL)],
                [InlineKeyboardButton("💬 AIM 커뮤니티", url=COMMUNITY_URL)],
            ]),
        )
        return

    attempts = {}
    for t in treasures:
        a = await get_attempt(user.id, t.id)
        if a:
            attempts[t.id] = a

    text = f"🗺 *도전 가능한 보물 목록* ({len(treasures)}개)\n\n✅=완료  ▶️=진행중  🆕=미도전"
    await update.message.reply_text(
        text,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=treasure_list_keyboard(treasures, attempts),
    )


async def cmd_gp(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return
    user = update.effective_user
    if not user:
        return

    gp = await get_gp(user.id, user.username)
    await update.message.reply_text(
        f"💰 *내 GP 잔액*\n\n현재 잔액: *{gp.balance:,} GP*\n\n"
        "GP는 힌트 구매 시 사용됩니다.\n"
        "• Lv1 힌트: 100 GP\n• Lv2 힌트: 300 GP\n• Lv3 힌트: 500 GP",
        parse_mode=ParseMode.MARKDOWN,
    )


async def _show_treasure_info(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    user_id: int,
    username: str | None,
    treasure_id: int,
) -> None:
    from database import get_treasure, question_count

    treasure = await get_treasure(treasure_id)
    if not treasure or not treasure.is_active:
        msg = "❌ 해당 보물을 찾을 수 없습니다."
        if update.message:
            await update.message.reply_text(msg)
        return

    attempt = await get_attempt(user_id, treasure_id)
    q_total = await question_count(treasure_id)

    progress = ""
    if attempt and attempt.is_completed:
        progress = "\n✅ *이미 완료한 보물입니다.*"
    elif attempt and attempt.is_failed:
        # Failed treasures are filtered by get_active_treasures, but just in case
        progress = "\n💀 *도전에 실패한 보물입니다.*"
    elif attempt:
        progress = f"\n▶️ *진행 중* — {attempt.current_question}/{q_total} 문제 (오답 {attempt.wrong_count}/3)"

    text = (
        f"🗺 *보물 #{treasure.id}*\n\n"
        f"📍 위치: {treasure.location_name or '비공개'}\n"
        f"🎁 상금: *{treasure.prize_gp:,} GP*\n"
        f"📝 {treasure.prize_description or '보물의 위치를 찾아보세요!'}\n"
        f"📋 문제 수: {q_total}문제{progress}"
    )

    is_completed = bool(attempt and attempt.is_completed)
    has_attempt = bool(attempt and not attempt.is_failed and not attempt.is_completed)

    if update.message:
        await update.message.reply_text(
            text,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=treasure_info_keyboard(treasure_id, has_attempt, is_completed),
        )
