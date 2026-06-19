"""Public commands: /start, /treasures, /gp, /lang."""

import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from telegram.constants import ParseMode

from config import COMMUNITY_URL, JUMPWORLD_URL, STARTING_P
from database import get_active_treasures, get_attempt, get_gp, get_lang, set_lang, question_count
from utils.i18n import t, detect_lang, SUPPORTED_LANGS
from utils.keyboards import (
    main_menu_keyboard,
    treasure_list_keyboard,
    treasure_info_keyboard,
    lang_select_keyboard,
)

logger = logging.getLogger(__name__)


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return

    user = update.effective_user
    username = user.username if user else None

    # Ensure GP record exists and get language
    gp = await get_gp(user.id if user else 0, username)
    lang = gp.lang or detect_lang(user.language_code if user else None)

    # Deep-link: /start treasure_<id>
    if context.args and context.args[0].startswith("treasure_"):
        try:
            treasure_id = int(context.args[0].split("_", 1)[1])
            await _show_treasure_info(update, context, user.id, username, treasure_id, lang)
            return
        except (ValueError, IndexError):
            pass

    text = t("start_welcome", lang, starting_p=STARTING_P)
    await update.message.reply_text(
        text,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=main_menu_keyboard(lang),
    )


async def cmd_treasures(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return
    user = update.effective_user
    if not user:
        return

    lang = await get_lang(user.id)
    treasures = await get_active_treasures(user.id)
    if not treasures:
        await update.message.reply_text(
            t("no_treasures_available", lang),
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton(t("btn_jumpworld", lang), url=JUMPWORLD_URL)],
                [InlineKeyboardButton(t("btn_community", lang), url=COMMUNITY_URL)],
            ]),
        )
        return

    attempts = {}
    for tr in treasures:
        a = await get_attempt(user.id, tr.id)
        if a:
            attempts[tr.id] = a

    await update.message.reply_text(
        t("treasures_header", lang, count=len(treasures)),
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=treasure_list_keyboard(treasures, attempts, lang),
    )


async def cmd_gp(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return
    user = update.effective_user
    if not user:
        return

    lang = await get_lang(user.id)
    gp = await get_gp(user.id, user.username)
    await update.message.reply_text(
        t("gp_balance_body", lang, balance=gp.balance),
        parse_mode=ParseMode.MARKDOWN,
    )


async def cmd_lang(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return
    user = update.effective_user
    if not user:
        return
    lang = await get_lang(user.id)
    await update.message.reply_text(
        t("lang_select", lang),
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=lang_select_keyboard(),
    )


async def cb_set_lang(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    user = update.effective_user
    if not user or not query:
        return

    chosen = query.data.split(":")[1]  # "lang:en" → "en"
    if chosen not in SUPPORTED_LANGS:
        await query.answer()
        return

    await set_lang(user.id, chosen, user.username)
    await query.answer()
    await query.edit_message_text(
        t("lang_changed", chosen),
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=main_menu_keyboard(chosen),
    )


async def _show_treasure_info(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    user_id: int,
    username: str | None,
    treasure_id: int,
    lang: str,
) -> None:
    from database import get_treasure

    treasure = await get_treasure(treasure_id)
    if not treasure or not treasure.is_active:
        if update.message:
            await update.message.reply_text(t("treasure_not_found", lang))
        return

    attempt = await get_attempt(user_id, treasure_id)
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
    has_attempt = bool(attempt and not attempt.is_failed and not attempt.is_completed)

    if update.message:
        await update.message.reply_text(
            text,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=treasure_info_keyboard(treasure_id, has_attempt, is_completed, lang),
        )
