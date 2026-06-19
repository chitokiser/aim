"""Admin commands: /newtreasure (ConversationHandler)."""

import logging
from datetime import datetime
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes, ConversationHandler
from telegram.constants import ParseMode

from config import ADMIN_IDS, GROUP_CHAT_ID, COMMUNITY_URL, JUMPWORLD_URL
from database import create_treasure, save_questions, get_treasure
from services.ai_service import reverse_geocode, generate_questions, build_coordinate_clues

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
        await update.message.reply_text("⛔ 관리자 전용 명령어입니다.")
        return ConversationHandler.END

    await update.message.reply_text(
        "🗺 *새 보물 등록*\n\n"
        "보물의 GPS 좌표를 입력해주세요.\n"
        "형식: `위도 경도`\n"
        "예시: `37.5665 126.9780`\n\n"
        "/cancel — 취소",
        parse_mode=ParseMode.MARKDOWN,
    )
    return ASK_COORDS


# ── Step 1: Coordinates ───────────────────────────────────────────────────────

async def handle_coords(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message or not update.effective_user:
        return ConversationHandler.END

    text = (update.message.text or "").strip()
    parts = text.replace(",", " ").split()
    if len(parts) < 2:
        await update.message.reply_text(
            "❌ 형식이 올바르지 않습니다.\n"
            "예시: `37.5665 126.9780`\n\n"
            "다시 입력해주세요.",
            parse_mode=ParseMode.MARKDOWN,
        )
        return ASK_COORDS

    try:
        lat = float(parts[0])
        lon = float(parts[1])
    except ValueError:
        await update.message.reply_text(
            "❌ 숫자 형식이 아닙니다. 예시: `37.5665 126.9780`",
            parse_mode=ParseMode.MARKDOWN,
        )
        return ASK_COORDS

    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        await update.message.reply_text("❌ 좌표 범위가 유효하지 않습니다 (위도 ±90, 경도 ±180).")
        return ASK_COORDS

    context.user_data["lat"] = lat
    context.user_data["lon"] = lon

    await update.message.reply_text(
        f"✅ 좌표 확인: `{lat:.6f}, {lon:.6f}`\n\n"
        "상금액을 GP 단위로 입력해주세요.\n"
        "예시: `5000` (5,000 GP)",
        parse_mode=ParseMode.MARKDOWN,
    )
    return ASK_PRIZE


# ── Step 2: Prize amount ──────────────────────────────────────────────────────

async def handle_prize(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message:
        return ConversationHandler.END

    text = (update.message.text or "").strip().replace(",", "")
    try:
        prize = int(text)
        if prize <= 0:
            raise ValueError
    except ValueError:
        await update.message.reply_text("❌ 양수 숫자를 입력해주세요. 예: `5000`", parse_mode=ParseMode.MARKDOWN)
        return ASK_PRIZE

    context.user_data["prize"] = prize

    await update.message.reply_text(
        f"✅ 상금: *{prize:,} GP*\n\n"
        "보물 설명을 입력해주세요.\n"
        "예: `서울 명동 근처에 숨겨진 특별한 보물`\n\n"
        "(설명 없이 기본값 사용하려면 `-` 입력)",
        parse_mode=ParseMode.MARKDOWN,
    )
    return ASK_DESC


# ── Step 3: Description → Generate & Create ───────────────────────────────────

async def handle_desc(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message or not update.effective_user:
        return ConversationHandler.END

    text = (update.message.text or "").strip()
    description = "" if text == "-" else text

    lat: float = context.user_data.get("lat", 0.0)
    lon: float = context.user_data.get("lon", 0.0)
    prize: int = context.user_data.get("prize", 0)
    admin_id = update.effective_user.id

    # Progress message
    progress_msg = await update.message.reply_text(
        "⏳ AI가 보물 문제를 생성 중입니다...\n(약 20~40초 소요)",
    )

    try:
        # 1. Reverse geocode
        geo = await reverse_geocode(lat, lon)
        location_name = geo.get("display_name", f"{lat:.4f}, {lon:.4f}")

        # 2. Generate questions
        questions = await generate_questions(lat, lon, geo)
        if len(questions) < 5:
            await progress_msg.edit_text("❌ AI 문제 생성에 실패했습니다. 다시 시도해주세요.")
            return ConversationHandler.END

        # Pad to 10 if AI returned fewer
        while len(questions) < 10:
            questions.append(questions[-1])
        questions = questions[:10]

        # 3. Create treasure in DB
        treasure = await create_treasure(
            latitude=lat,
            longitude=lon,
            location_name=location_name[:500],
            prize_gp=prize,
            prize_description=description[:500],
            created_by=admin_id,
            group_chat_id=GROUP_CHAT_ID,
        )

        # 4. Save questions
        await save_questions(treasure.id, questions)

        # 5. Update progress
        await progress_msg.edit_text(
            f"✅ 보물 #{treasure.id} 생성 완료!\n"
            f"📍 {location_name[:100]}\n"
            f"🎁 {prize:,} GP\n"
            f"📋 {len(questions)}문제 생성됨\n\n"
            "그룹에 공지 중..."
        )

        # 6. Announce in group
        bot_username = context.bot_data.get("username", "")
        await _announce_in_group(context, treasure, len(questions), bot_username)

        await progress_msg.edit_text(
            f"✅ 보물 #{treasure.id} 등록 및 그룹 공지 완료!\n"
            f"📍 위치: {location_name[:100]}\n"
            f"🎁 상금: {prize:,} GP\n"
            f"📋 문제: {len(questions)}개"
        )

    except Exception as e:
        logger.exception("Failed to create treasure: %s", e)
        await progress_msg.edit_text(
            f"❌ 오류 발생: {e}\n다시 /newtreasure 로 시도해주세요."
        )

    context.user_data.clear()
    return ConversationHandler.END


async def _announce_in_group(context: ContextTypes.DEFAULT_TYPE, treasure, q_count: int, bot_username: str) -> None:
    if not GROUP_CHAT_ID:
        logger.warning("GROUP_CHAT_ID not set — skipping group announcement")
        return

    deeplink = f"https://t.me/{bot_username}?start=treasure_{treasure.id}" if bot_username else ""
    clues = build_coordinate_clues(treasure.latitude, treasure.longitude)
    first_clue = clues[0]

    text = (
        f"🗺 *새로운 보물이 등장했습니다!* 🎉\n\n"
        f"🔢 보물 번호: *#{treasure.id}*\n"
        f"🎁 상금: *{treasure.prize_gp:,} GP*\n"
        f"📋 총 {q_count}문제 (AI 생성)\n\n"
        f"🧩 *좌표 힌트 (Q1 정답 시 공개):*\n"
        f"`{first_clue}`\n\n"
        f"⚠️ 3번 오답 시 도전 불가!\n"
        f"💡 힌트 구매 가능 (GP 필요)\n\n"
        f"📝 {treasure.prize_description or '보물의 정확한 위치를 찾아보세요!'}"
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

    try:
        await context.bot.send_message(
            chat_id=GROUP_CHAT_ID,
            text=text,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=keyboard,
        )
    except Exception as e:
        logger.error("Failed to send group announcement: %s", e)


# ── Cancel ────────────────────────────────────────────────────────────────────

async def handle_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.message:
        await update.message.reply_text("❌ 보물 등록이 취소되었습니다.")
    context.user_data.clear()
    return ConversationHandler.END


# ── Admin stats ───────────────────────────────────────────────────────────────

async def cmd_admin(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not update.effective_user:
        return
    if not _is_admin(update.effective_user.id):
        await update.message.reply_text("⛔ 관리자 전용 명령어입니다.")
        return

    from sqlalchemy import select, func as sqlfunc
    from database import SessionLocal, Treasure, UserAttempt, UserGP

    async with SessionLocal() as session:
        total_treasures = (await session.execute(select(sqlfunc.count()).select_from(Treasure))).scalar()
        active_treasures = (
            await session.execute(select(sqlfunc.count()).select_from(Treasure).where(Treasure.is_active == True))
        ).scalar()
        total_attempts = (await session.execute(select(sqlfunc.count()).select_from(UserAttempt))).scalar()
        completions = (
            await session.execute(select(sqlfunc.count()).select_from(UserAttempt).where(UserAttempt.is_completed == True))
        ).scalar()
        total_players = (await session.execute(select(sqlfunc.count()).select_from(UserGP))).scalar()

    text = (
        f"🛠 *관리자 패널*\n\n"
        f"🗺 전체 보물: {total_treasures}개 (활성: {active_treasures}개)\n"
        f"👥 총 플레이어: {total_players}명\n"
        f"🎮 총 도전: {total_attempts}회\n"
        f"✅ 완료: {completions}회\n\n"
        f"*명령어*\n"
        f"/newtreasure — 새 보물 등록\n"
        f"/admin — 이 패널"
    )
    await update.message.reply_text(text, parse_mode=ParseMode.MARKDOWN)
