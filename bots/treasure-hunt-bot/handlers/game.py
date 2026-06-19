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
    get_lang,
    deduct_gp,
    record_hint_purchase,
    question_count,
)
from services.ai_service import build_coordinate_clues
from utils.i18n import t
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
    lang: str = "ko",
) -> str:
    q = await get_question_by_order(treasure_id, order_num)
    if not q:
        return t("question_load_error", lang)

    opts = [q.option_a, q.option_b, q.option_c, q.option_d]
    text = t("question_header", lang, tid=treasure_id, q=order_num, total=total, question=q.question_text)
    text += f"A) {opts[0]}\nB) {opts[1]}\nC) {opts[2]}\nD) {opts[3]}\n"

    hint_values = {1: q.hint1, 2: q.hint2, 3: q.hint3}
    if purchased_hints:
        text += t("purchased_hints_header", lang)
        for level in sorted(purchased_hints):
            text += f"  Lv{level}: {hint_values[level]}\n"

    if wrong_count > 0:
        crosses = "❌" * wrong_count + "⬜" * (3 - wrong_count)
        text += t("wrong_count_display", lang, crosses=crosses, count=wrong_count)

    return text


# ── Treasure list ─────────────────────────────────────────────────────────────

async def cb_treasure_list(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    user = update.effective_user
    if not user:
        return

    lang = await get_lang(user.id)
    treasures = await get_active_treasures(user.id)
    if not treasures:
        await query.edit_message_text(
            t("no_treasures_available", lang),
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton(t("btn_jumpworld", lang), url=JUMPWORLD_URL)],
                [InlineKeyboardButton(t("btn_community", lang), url=COMMUNITY_URL)],
            ]),
        )
        return

    attempts: dict = {}
    for tr in treasures:
        a = await get_attempt(user.id, tr.id)
        if a:
            attempts[tr.id] = a

    await query.edit_message_text(
        t("treasures_header", lang, count=len(treasures)),
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=treasure_list_keyboard(treasures, attempts, lang),
    )


# ── Treasure info ─────────────────────────────────────────────────────────────

async def cb_treasure_info(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    user = update.effective_user
    if not user:
        return

    lang = await get_lang(user.id)
    treasure_id = int(query.data.split(":")[1])
    treasure = await get_treasure(treasure_id)
    if not treasure or not treasure.is_active:
        await query.edit_message_text(t("treasure_not_found", lang))
        return

    attempt = await get_attempt(user.id, treasure_id)
    q_total = await question_count(treasure_id)

    progress = ""
    if attempt and attempt.is_completed:
        progress = t("progress_completed", lang)
    elif attempt and attempt.is_failed:
        progress = t("progress_failed", lang)
    elif attempt:
        progress = t("progress_ongoing", lang,
                     current=attempt.current_question, total=q_total, wrong=attempt.wrong_count)

    text = t(
        "treasure_info", lang,
        id=treasure.id,
        prize=treasure.prize_gp,
        description=treasure.prize_description or t("treasure_default_desc", lang),
        qtotal=q_total,
        progress=progress,
    )

    is_completed = bool(attempt and attempt.is_completed)
    is_failed = bool(attempt and attempt.is_failed)
    has_attempt = bool(attempt and not attempt.is_failed and not attempt.is_completed)

    if is_failed:
        kb = InlineKeyboardMarkup([
            [InlineKeyboardButton(t("btn_other_treasures", lang), callback_data="tl")],
        ])
    else:
        kb = treasure_info_keyboard(treasure_id, has_attempt, is_completed, lang)

    await query.edit_message_text(text, parse_mode=ParseMode.MARKDOWN, reply_markup=kb)


# ── Start / Resume game ───────────────────────────────────────────────────────

async def cb_treasure_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    user = update.effective_user
    if not user:
        return

    lang = await get_lang(user.id)
    treasure_id = int(query.data.split(":")[1])
    treasure = await get_treasure(treasure_id)
    if not treasure or not treasure.is_active:
        await query.edit_message_text(t("treasure_not_found", lang))
        return

    attempt = await get_or_create_attempt(user.id, user.username, treasure_id)

    if attempt.is_failed:
        await query.edit_message_text(
            t("already_failed", lang),
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton(t("btn_other_treasures", lang), callback_data="tl")
            ]]),
        )
        return

    if attempt.is_completed:
        await query.edit_message_text(
            t("already_completed_body", lang,
              lat=treasure.latitude, lon=treasure.longitude),
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=victory_keyboard(treasure.latitude, treasure.longitude, lang),
        )
        return

    await _show_question(query, user.id, treasure_id, attempt.current_question, lang)


# ── Show question (internal) ──────────────────────────────────────────────────

async def cb_show_question(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles 'nxt:<tid>:<q>' — show (next or same) question."""
    query = update.callback_query
    await query.answer()
    user = update.effective_user
    if not user:
        return

    lang = await get_lang(user.id)
    _, tid_s, q_s = query.data.split(":")
    treasure_id, order_num = int(tid_s), int(q_s)

    attempt = await get_attempt(user.id, treasure_id)
    if not attempt or attempt.is_failed or attempt.is_completed:
        await query.edit_message_text(t("game_ended", lang), reply_markup=game_over_keyboard(lang))
        return

    await _show_question(query, user.id, treasure_id, order_num, lang)


async def _show_question(query_obj, user_id: int, treasure_id: int, order_num: int, lang: str = "ko") -> None:
    q_total = await question_count(treasure_id)
    q = await get_question_by_order(treasure_id, order_num)
    if not q:
        await query_obj.edit_message_text(t("question_load_error", lang))
        return

    attempt = await get_attempt(user_id, treasure_id)
    wrong_count = attempt.wrong_count if attempt else 0

    purchased = await get_purchased_hints(user_id, q.id)

    text = await _build_question_text(treasure_id, order_num, q_total, wrong_count, purchased, lang)
    kb = question_keyboard(treasure_id, order_num, purchased, lang)

    await query_obj.edit_message_text(text, parse_mode=ParseMode.MARKDOWN, reply_markup=kb)


# ── Answer handler ────────────────────────────────────────────────────────────

async def cb_answer(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    user = update.effective_user
    if not user:
        return

    lang = await get_lang(user.id)

    # "ans:<tid>:<q>:<opt>"
    parts = query.data.split(":")
    treasure_id, order_num, chosen = int(parts[1]), int(parts[2]), int(parts[3])

    attempt = await get_attempt(user.id, treasure_id)
    if not attempt or attempt.is_failed or attempt.is_completed:
        await query.edit_message_text(t("game_ended", lang), reply_markup=game_over_keyboard(lang))
        return

    if attempt.current_question != order_num:
        await query.answer(t("already_answered", lang), show_alert=True)
        return

    q = await get_question_by_order(treasure_id, order_num)
    if not q:
        await query.edit_message_text(t("question_load_error", lang))
        return

    treasure = await get_treasure(treasure_id)
    if not treasure:
        await query.edit_message_text(t("treasure_load_error", lang))
        return

    q_total = await question_count(treasure_id)
    is_correct = (chosen == q.correct_option)

    if is_correct:
        clues = build_coordinate_clues(treasure.latitude, treasure.longitude, lang)
        clue = clues[order_num - 1]

        if order_num >= q_total:
            # ── VICTORY ──────────────────────────────────────────────────────
            await update_attempt(user.id, treasure_id, is_completed=True, completed_at=datetime.now())
            text = t(
                "victory", lang,
                total=q_total,
                lat=treasure.latitude,
                lon=treasure.longitude,
                prize=treasure.prize_gp,
                description=treasure.prize_description or "",
            )
            await query.edit_message_text(
                text,
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=victory_keyboard(treasure.latitude, treasure.longitude, lang),
            )
            bot_username = getattr(context.bot, "username", None) or "AITreasureHuntBot"
            winner_name = user.username or user.first_name or "Someone"
            tweet = (
                f"🏆 Treasure Found! / 보물 발견!\n\n"
                f"@{winner_name} solved Treasure #{treasure_id}! 🎉\n"
                f"🎁 Prize: {treasure.prize_gp:,} P\n\n"
                f"⚡ Can you find the next one?\n"
                f"👉 https://t.me/{bot_username}\n"
                f"💬 https://t.me/ai119"
            )
            from services.threads import post_threads
            await post_threads(tweet)
        else:
            # ── CORRECT, next question ────────────────────────────────────────
            await update_attempt(user.id, treasure_id, current_question=order_num + 1)
            text = t("correct_answer", lang, q=order_num, total=q_total, clue=clue)
            await query.edit_message_text(
                text,
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=after_correct_keyboard(treasure_id, order_num + 1, lang),
            )
    else:
        # ── WRONG ANSWER ──────────────────────────────────────────────────────
        new_wrong = attempt.wrong_count + 1

        if new_wrong >= 3:
            await update_attempt(user.id, treasure_id, wrong_count=new_wrong, is_failed=True)
            safe_opt = q.correct_option if 0 <= q.correct_option <= 3 else 0
            correct_label = OPTION_LABELS[safe_opt]
            correct_text = [q.option_a, q.option_b, q.option_c, q.option_d][safe_opt]
            text = t("game_over", lang, correct_label=correct_label, correct_text=correct_text)
            await query.edit_message_text(
                text,
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=game_over_keyboard(lang),
            )
        else:
            await update_attempt(user.id, treasure_id, wrong_count=new_wrong)
            remaining = 3 - new_wrong
            text = t("wrong_answer", lang, remaining=remaining)
            await query.edit_message_text(
                text,
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=after_wrong_keyboard(treasure_id, order_num, lang),
            )


# ── Hint: confirm purchase ────────────────────────────────────────────────────

async def cb_need_hint(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    user = update.effective_user
    if not user:
        await query.answer()
        return

    lang = await get_lang(user.id)

    # "nh:<tid>:<q>:<lv>"
    parts = query.data.split(":")
    treasure_id, order_num, level = int(parts[1]), int(parts[2]), int(parts[3])

    q = await get_question_by_order(treasure_id, order_num)
    if not q:
        await query.answer(t("question_load_error", lang), show_alert=True)
        return

    purchased = await get_purchased_hints(user.id, q.id)
    if level in purchased:
        hint_text = {1: q.hint1, 2: q.hint2, 3: q.hint3}[level]
        await query.answer(t("hint_already_purchased", lang, level=level, text=hint_text[:200]), show_alert=True)
        return

    cost = HINT_COSTS.get(level, 0)
    gp = await get_gp(user.id, user.username)

    await query.answer()

    q_total = await question_count(treasure_id)
    attempt = await get_attempt(user.id, treasure_id)
    wrong_count = attempt.wrong_count if attempt else 0
    text = await _build_question_text(treasure_id, order_num, q_total, wrong_count, set(purchased), lang)
    text += t("hint_balance_info", lang, balance=gp.balance, level=level, cost=cost)

    await query.edit_message_text(
        text,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=hint_confirm_keyboard(treasure_id, order_num, level, cost, lang),
    )


# ── Hint: execute purchase ────────────────────────────────────────────────────

async def cb_buy_hint(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    user = update.effective_user
    if not user:
        await query.answer()
        return

    lang = await get_lang(user.id)

    # "bh:<tid>:<q>:<lv>"
    parts = query.data.split(":")
    treasure_id, order_num, level = int(parts[1]), int(parts[2]), int(parts[3])

    q = await get_question_by_order(treasure_id, order_num)
    if not q:
        await query.answer(t("question_load_error", lang), show_alert=True)
        return

    purchased = await get_purchased_hints(user.id, q.id)
    if level in purchased:
        hint_text = {1: q.hint1, 2: q.hint2, 3: q.hint3}[level]
        await query.answer(t("hint_already_purchased", lang, level=level, text=hint_text[:200]), show_alert=True)
        await _show_question(query, user.id, treasure_id, order_num, lang)
        return

    cost = HINT_COSTS.get(level, 0)
    success = await deduct_gp(user.id, cost)

    if not success:
        gp = await get_gp(user.id, user.username)
        await query.answer(
            t("hint_insufficient", lang, balance=gp.balance, cost=cost),
            show_alert=True,
        )
        await _show_question(query, user.id, treasure_id, order_num, lang)
        return

    await record_hint_purchase(user.id, q.id, level, cost)
    await query.answer(t("hint_bought", lang, level=level, cost=cost), show_alert=True)
    await _show_question(query, user.id, treasure_id, order_num, lang)


# ── Menu callback ─────────────────────────────────────────────────────────────

async def cb_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    user = update.effective_user
    lang = await get_lang(user.id) if user else "ko"
    await query.edit_message_text(
        t("menu_text", lang),
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=main_menu_keyboard(lang),
    )


async def cb_noop(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.callback_query.answer()
