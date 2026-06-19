"""Game flow: treasure list, question display, answer handling, hint purchases."""

import logging
from datetime import datetime
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from telegram.constants import ParseMode

from config import HINT_COSTS, JUMPWORLD_URL, COMMUNITY_URL
from database import (
    get_active_treasures,
    get_attempt,
    get_or_create_attempt,
    get_treasure,
    get_question_by_order,
    get_purchased_hints,
    update_attempt,
    get_gp,
    deduct_gp,
    record_hint_purchase,
    question_count,
)
from services.ai_service import build_coordinate_clues
from utils.keyboards import (
    main_menu_keyboard,
    treasure_list_keyboard,
    treasure_info_keyboard,
    question_keyboard,
    hint_confirm_keyboard,
    after_correct_keyboard,
    after_wrong_keyboard,
    game_over_keyboard,
    victory_keyboard,
)

logger = logging.getLogger(__name__)

OPTION_LABELS = ["A", "B", "C", "D"]


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _build_question_text(
    treasure_id: int,
    order_num: int,
    total: int,
    wrong_count: int,
    purchased_hints: set[int],
) -> str:
    q = await get_question_by_order(treasure_id, order_num)
    if not q:
        return "❌ 문제를 불러오지 못했습니다."

    opts = [q.option_a, q.option_b, q.option_c, q.option_d]
    text = (
        f"🗺 *보물 #{treasure_id} — Q{order_num}/{total}*\n\n"
        f"❓ *{q.question_text}*\n\n"
        f"A) {opts[0]}\n"
        f"B) {opts[1]}\n"
        f"C) {opts[2]}\n"
        f"D) {opts[3]}\n"
    )

    # Show already-purchased hints inline
    hint_values = {1: q.hint1, 2: q.hint2, 3: q.hint3}
    if purchased_hints:
        text += "\n💡 *구매한 힌트:*\n"
        for level in sorted(purchased_hints):
            text += f"  Lv{level}: {hint_values[level]}\n"

    # Wrong count indicator
    if wrong_count > 0:
        crosses = "❌" * wrong_count + "⬜" * (3 - wrong_count)
        text += f"\n오답 기록: {crosses} ({wrong_count}/3)"

    return text


async def _get_question_obj(treasure_id: int, order_num: int):
    return await get_question_by_order(treasure_id, order_num)


# ── Treasure list ─────────────────────────────────────────────────────────────

async def cb_treasure_list(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    user = update.effective_user
    if not user:
        return

    treasures = await get_active_treasures(user.id)
    if not treasures:
        await query.edit_message_text(
            "🗺 현재 도전할 수 있는 보물이 없습니다.\n곧 새로운 보물이 등장할 예정입니다!",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("🏪 Jumpworld", url=JUMPWORLD_URL)],
                [InlineKeyboardButton("💬 AIM 커뮤니티", url=COMMUNITY_URL)],
            ]),
        )
        return

    attempts: dict = {}
    for t in treasures:
        a = await get_attempt(user.id, t.id)
        if a:
            attempts[t.id] = a

    text = f"🗺 *도전 가능한 보물 목록* ({len(treasures)}개)\n\n✅=완료  ▶️=진행중  🆕=미도전"
    await query.edit_message_text(
        text,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=treasure_list_keyboard(treasures, attempts),
    )


# ── Treasure info ─────────────────────────────────────────────────────────────

async def cb_treasure_info(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    user = update.effective_user
    if not user:
        return

    treasure_id = int(query.data.split(":")[1])
    treasure = await get_treasure(treasure_id)
    if not treasure or not treasure.is_active:
        await query.edit_message_text("❌ 해당 보물을 찾을 수 없습니다.")
        return

    attempt = await get_attempt(user.id, treasure_id)
    q_total = await question_count(treasure_id)

    progress = ""
    if attempt and attempt.is_completed:
        progress = "\n✅ *이미 완료한 보물입니다.*"
    elif attempt and attempt.is_failed:
        progress = "\n💀 *도전에 실패한 보물입니다.*"
    elif attempt:
        progress = f"\n▶️ *진행 중* — {attempt.current_question}/{q_total} 문제 (오답 {attempt.wrong_count}/3)"

    text = (
        f"🗺 *보물 #{treasure.id}*\n\n"
        f"📍 위치: 🔒 10문제 정답 시 공개\n"
        f"🎁 상금: *{treasure.prize_gp:,} GP*\n"
        f"📝 {treasure.prize_description or '보물의 위치를 찾아보세요!'}\n"
        f"📋 문제 수: {q_total}문제{progress}"
    )

    is_completed = bool(attempt and attempt.is_completed)
    is_failed = bool(attempt and attempt.is_failed)
    has_attempt = bool(attempt and not attempt.is_failed and not attempt.is_completed)

    if is_failed:
        kb = InlineKeyboardMarkup([
            [InlineKeyboardButton("📋 다른 보물 도전", callback_data="tl")],
        ])
    else:
        kb = treasure_info_keyboard(treasure_id, has_attempt, is_completed)

    await query.edit_message_text(text, parse_mode=ParseMode.MARKDOWN, reply_markup=kb)


# ── Start / Resume game ───────────────────────────────────────────────────────

async def cb_treasure_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    user = update.effective_user
    if not user:
        return

    treasure_id = int(query.data.split(":")[1])
    treasure = await get_treasure(treasure_id)
    if not treasure or not treasure.is_active:
        await query.edit_message_text("❌ 해당 보물을 찾을 수 없습니다.")
        return

    attempt = await get_or_create_attempt(user.id, user.username, treasure_id)

    if attempt.is_failed:
        await query.edit_message_text(
            "💀 이미 실패한 보물입니다. 다른 보물에 도전하세요!",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("📋 보물 목록", callback_data="tl")]]),
        )
        return

    if attempt.is_completed:
        clues = build_coordinate_clues(treasure.latitude, treasure.longitude)
        await query.edit_message_text(
            f"✅ 이미 완료한 보물입니다!\n\n"
            f"📍 {clues[-1]}\n\n"
            f"🌍 https://maps.google.com/?q={treasure.latitude},{treasure.longitude}",
            reply_markup=victory_keyboard(treasure.latitude, treasure.longitude),
        )
        return

    # Show current question
    await _show_question(query, user.id, treasure_id, attempt.current_question)


# ── Show question (internal) ──────────────────────────────────────────────────

async def cb_show_question(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles 'nxt:<tid>:<q>' — show (next or same) question."""
    query = update.callback_query
    await query.answer()
    user = update.effective_user
    if not user:
        return

    _, tid_s, q_s = query.data.split(":")
    treasure_id, order_num = int(tid_s), int(q_s)

    attempt = await get_attempt(user.id, treasure_id)
    if not attempt or attempt.is_failed or attempt.is_completed:
        await query.edit_message_text("❌ 이미 종료된 게임입니다.", reply_markup=game_over_keyboard())
        return

    await _show_question(query, user.id, treasure_id, order_num)


async def _show_question(query_obj, user_id: int, treasure_id: int, order_num: int) -> None:
    q_total = await question_count(treasure_id)
    q = await get_question_by_order(treasure_id, order_num)
    if not q:
        await query_obj.edit_message_text("❌ 문제를 불러오지 못했습니다.")
        return

    attempt = await get_attempt(user_id, treasure_id)
    wrong_count = attempt.wrong_count if attempt else 0

    purchased = await get_purchased_hints(user_id, q.id)

    text = await _build_question_text(treasure_id, order_num, q_total, wrong_count, purchased)
    kb = question_keyboard(treasure_id, order_num, purchased)

    await query_obj.edit_message_text(text, parse_mode=ParseMode.MARKDOWN, reply_markup=kb)


# ── Answer handler ────────────────────────────────────────────────────────────

async def cb_answer(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    user = update.effective_user
    if not user:
        return

    # "ans:<tid>:<q>:<opt>"
    parts = query.data.split(":")
    treasure_id, order_num, chosen = int(parts[1]), int(parts[2]), int(parts[3])

    attempt = await get_attempt(user.id, treasure_id)
    if not attempt or attempt.is_failed or attempt.is_completed:
        await query.edit_message_text("❌ 이미 종료된 게임입니다.", reply_markup=game_over_keyboard())
        return

    # Guard against replaying a finished question (e.g. double-tap)
    if attempt.current_question != order_num:
        await query.answer("이미 다음 문제로 진행했습니다.", show_alert=True)
        return

    q = await get_question_by_order(treasure_id, order_num)
    if not q:
        await query.edit_message_text("❌ 문제를 찾을 수 없습니다.")
        return

    treasure = await get_treasure(treasure_id)
    if not treasure:
        await query.edit_message_text("❌ 보물을 찾을 수 없습니다.")
        return

    q_total = await question_count(treasure_id)
    is_correct = (chosen == q.correct_option)

    if is_correct:
        clues = build_coordinate_clues(treasure.latitude, treasure.longitude)
        clue = clues[order_num - 1]

        if order_num >= q_total:
            # ── VICTORY ──────────────────────────────────────────────────────
            await update_attempt(user.id, treasure_id, is_completed=True, completed_at=datetime.now())
            text = (
                f"🎉 *보물 발견! 축하합니다!*\n\n"
                f"🏆 {q_total}문제를 모두 맞히셨습니다!\n\n"
                f"📍 *전체 좌표 공개:*\n"
                f"```\n위도: {treasure.latitude:.6f}\n경도: {treasure.longitude:.6f}\n```\n\n"
                f"🌍 Google Maps:\n"
                f"https://maps.google.com/?q={treasure.latitude},{treasure.longitude}\n\n"
                f"🎁 상금: *{treasure.prize_gp:,} GP*\n"
                f"{treasure.prize_description or ''}"
            )
            await query.edit_message_text(
                text,
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=victory_keyboard(treasure.latitude, treasure.longitude),
            )
        else:
            # ── CORRECT, next question ────────────────────────────────────────
            await update_attempt(user.id, treasure_id, current_question=order_num + 1)
            text = (
                f"✅ *정답입니다!* ({order_num}/{q_total})\n\n"
                f"📍 좌표 단서 공개:\n```\n{clue}\n```\n\n"
                f"다음 문제로 이동하세요!"
            )
            await query.edit_message_text(
                text,
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=after_correct_keyboard(treasure_id, order_num + 1),
            )
    else:
        # ── WRONG ANSWER ──────────────────────────────────────────────────────
        new_wrong = attempt.wrong_count + 1

        if new_wrong >= 3:
            await update_attempt(user.id, treasure_id, wrong_count=new_wrong, is_failed=True)
            correct_label = OPTION_LABELS[q.correct_option]
            text = (
                f"💀 *도전 실패!*\n\n"
                f"3번 오답으로 이 보물에 대한 도전이 종료됩니다.\n\n"
                f"정답: *{correct_label}) {[q.option_a, q.option_b, q.option_c, q.option_d][q.correct_option]}*\n\n"
                f"다른 보물에 도전해보세요! 💪"
            )
            await query.edit_message_text(
                text,
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=game_over_keyboard(),
            )
        else:
            await update_attempt(user.id, treasure_id, wrong_count=new_wrong)
            remaining = 3 - new_wrong
            text = (
                f"❌ *오답입니다!*\n\n"
                f"남은 기회: *{remaining}번*\n\n"
                f"다시 도전하세요!"
            )
            await query.edit_message_text(
                text,
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=after_wrong_keyboard(treasure_id, order_num),
            )


# ── Hint: confirm purchase ────────────────────────────────────────────────────

async def cb_need_hint(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    user = update.effective_user
    if not user:
        await query.answer()
        return

    # "nh:<tid>:<q>:<lv>"
    parts = query.data.split(":")
    treasure_id, order_num, level = int(parts[1]), int(parts[2]), int(parts[3])

    q = await get_question_by_order(treasure_id, order_num)
    if not q:
        await query.answer("❌ 문제를 찾을 수 없습니다.", show_alert=True)
        return

    # Already purchased?
    purchased = await get_purchased_hints(user.id, q.id)
    if level in purchased:
        hint_text = {1: q.hint1, 2: q.hint2, 3: q.hint3}[level]
        await query.answer(f"💡 Lv{level} 힌트: {hint_text[:200]}", show_alert=True)
        return

    cost = HINT_COSTS.get(level, 0)
    gp = await get_gp(user.id, user.username)

    await query.answer()
    await query.edit_message_reply_markup(
        reply_markup=hint_confirm_keyboard(treasure_id, order_num, level, cost),
    )

    # Append GP balance info as an alert text via edit_message_text
    q_total = await question_count(treasure_id)
    attempt = await get_attempt(user.id, treasure_id)
    wrong_count = attempt.wrong_count if attempt else 0
    purchased_before = set(purchased)
    text = await _build_question_text(treasure_id, order_num, q_total, wrong_count, purchased_before)
    text += f"\n\n💰 현재 GP: *{gp.balance:,}*\n💡 Lv{level} 힌트 구매: *{cost:,} GP*"

    await query.edit_message_text(
        text,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=hint_confirm_keyboard(treasure_id, order_num, level, cost),
    )


# ── Hint: execute purchase ────────────────────────────────────────────────────

async def cb_buy_hint(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    user = update.effective_user
    if not user:
        await query.answer()
        return

    # "bh:<tid>:<q>:<lv>"
    parts = query.data.split(":")
    treasure_id, order_num, level = int(parts[1]), int(parts[2]), int(parts[3])

    q = await get_question_by_order(treasure_id, order_num)
    if not q:
        await query.answer("❌ 문제를 찾을 수 없습니다.", show_alert=True)
        return

    # Check if already purchased (double-tap guard)
    purchased = await get_purchased_hints(user.id, q.id)
    if level in purchased:
        await query.answer("이미 구매한 힌트입니다.", show_alert=True)
        await _show_question(query, user.id, treasure_id, order_num)
        return

    cost = HINT_COSTS.get(level, 0)
    success = await deduct_gp(user.id, cost)

    if not success:
        gp = await get_gp(user.id, user.username)
        await query.answer(
            f"❌ GP가 부족합니다.\n현재 잔액: {gp.balance:,} GP / 필요: {cost:,} GP",
            show_alert=True,
        )
        # Restore question view
        await _show_question(query, user.id, treasure_id, order_num)
        return

    await record_hint_purchase(user.id, q.id, level, cost)
    hint_text = {1: q.hint1, 2: q.hint2, 3: q.hint3}[level]

    await query.answer(f"✅ Lv{level} 힌트 구매 완료! -{cost:,} GP", show_alert=True)
    # Refresh question display with new hint visible
    await _show_question(query, user.id, treasure_id, order_num)


# ── Menu callback ─────────────────────────────────────────────────────────────

async def cb_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    from config import STARTING_GP
    text = (
        "🗺 *AI 보물찾기*\n\n"
        "보물의 좌표를 AI 문제로 찾아보세요!\n\n"
        f"💡 힌트: Lv1=100 GP / Lv2=300 GP / Lv3=500 GP\n"
        "⚠️ 3번 오답 시 해당 보물 도전 불가"
    )
    await query.edit_message_text(text, parse_mode=ParseMode.MARKDOWN, reply_markup=main_menu_keyboard())


async def cb_noop(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.callback_query.answer()
