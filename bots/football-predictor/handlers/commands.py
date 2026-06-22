from __future__ import annotations

import logging
from datetime import datetime, timezone

import pytz
from telegram import Update
from telegram.ext import ContextTypes

from telegram import InlineKeyboardButton, InlineKeyboardMarkup

from config import DAILY_P, WELCOME_BONUS_P, COMMUNITY_URL, SITE_URL
from database import AsyncSessionLocal, claim_daily, get_or_create_user, get_user, get_user_predictions_with_matches
from i18n import detect_lang, t
from utils.auth import create_bot_login_url
from utils.formatters import format_bet_history, format_profile
from utils.keyboards import main_menu

logger = logging.getLogger(__name__)

KST = pytz.timezone("Asia/Seoul")


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.effective_user or not update.message:
        return

    tg_user = update.effective_user
    chat = update.effective_chat
    lang = detect_lang(tg_user.language_code)

    # In group/supergroup: redirect users to private DM
    if chat and chat.type in ("group", "supergroup"):
        bot_username = context.bot.username or ""
        dm_url = f"https://t.me/{bot_username}?start=hello"
        group_keyboard = InlineKeyboardMarkup([
            [
                InlineKeyboardButton("🤖 봇 DM 시작 / Start Bot", url=dm_url),
                InlineKeyboardButton("⚽ Football Community", url=COMMUNITY_URL),
            ],
            [InlineKeyboardButton("🌐 AI119 유료 서비스 / Premium", url=SITE_URL)],
        ])
        await update.message.reply_text(
            "⚽ *AI119 Football Predictor*\n\n"
            "📩 아래 버튼을 눌러 봇과 1:1 대화를 시작하세요!\n"
            "📩 Tap the button below to start the bot in private!\n"
            "📩 Nhấn nút bên dưới để bắt đầu bot riêng tư!",
            parse_mode="Markdown",
            reply_markup=group_keyboard,
        )
        return

    # Private chat: full onboarding
    async with AsyncSessionLocal() as session:
        user, is_new = await get_or_create_user(
            session,
            telegram_id=tg_user.id,
            username=tg_user.username,
            first_name=tg_user.first_name,
            language=lang,
            welcome_p=WELCOME_BONUS_P,
        )
        p_balance = user.p_balance

    name = tg_user.first_name or tg_user.username or "User"
    login_url = create_bot_login_url(tg_user.id, tg_user.first_name or "", tg_user.username or "")

    if is_new:
        text = (
            f"*{t(lang, 'welcome_title')}*\n\n"
            + t(lang, "welcome_new", name=name, p=WELCOME_BONUS_P)
        )
    else:
        text = (
            f"*{t(lang, 'welcome_title')}*\n\n"
            + t(lang, "welcome_back", name=name, p=p_balance)
        )

    await update.message.reply_text(
        text,
        parse_mode="Markdown",
        reply_markup=main_menu(lang, login_url=login_url),
    )


async def cmd_daily(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.effective_user or not update.message:
        return

    tg_user = update.effective_user

    async with AsyncSessionLocal() as session:
        user = await get_user(session, tg_user.id)
        if not user:
            await update.message.reply_text("Please use /start first.")
            return

        lang = user.language
        claimed, _ = await claim_daily(session, user, DAILY_P)
        p_balance = user.p_balance
        streak = user.streak_days

    if claimed:
        text = t(lang, "daily_claimed", p=DAILY_P, streak=streak, p_balance=p_balance)
    else:
        text = t(lang, "daily_already", p_balance=p_balance)

    await update.message.reply_text(text, parse_mode="Markdown")


async def cmd_my(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.effective_user or not update.message:
        return

    tg_user = update.effective_user
    async with AsyncSessionLocal() as session:
        user = await get_user(session, tg_user.id)
        if not user:
            await update.message.reply_text("Please use /start first.")
            return
        lang = user.language
        preds = await get_user_predictions_with_matches(session, user.id)
        history_text = format_bet_history(preds, user, lang)

    await update.message.reply_text(
        history_text,
        parse_mode="Markdown",
        reply_markup=main_menu(lang),
    )


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.effective_user or not update.message:
        return

    tg_user = update.effective_user
    lang = "en"

    async with AsyncSessionLocal() as session:
        user = await get_user(session, tg_user.id)
        if user:
            lang = user.language

    await update.message.reply_text(
        t(lang, "help_text"),
        parse_mode="Markdown",
        reply_markup=main_menu(lang),
    )


async def cmd_lang(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Allow users to manually switch language: /lang en | ko | vi"""
    if not update.effective_user or not update.message:
        return

    args = context.args or []
    if not args or args[0].lower() not in ("en", "ko", "vi"):
        await update.message.reply_text(
            "Usage: /lang en | ko | vi\n사용법: /lang ko\nCách dùng: /lang vi"
        )
        return

    new_lang = args[0].lower()
    tg_user = update.effective_user

    async with AsyncSessionLocal() as session:
        from database import set_user_language
        await set_user_language(session, tg_user.id, new_lang)

    confirmations = {
        "en": "✅ Language set to English.",
        "ko": "✅ 언어가 한국어로 변경됐습니다.",
        "vi": "✅ Đã đổi ngôn ngữ sang Tiếng Việt.",
    }
    await update.message.reply_text(confirmations[new_lang])


# ---------------------------------------------------------------------------
# Callback handlers for main-menu inline buttons
# ---------------------------------------------------------------------------

async def cmd_chatid(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.effective_chat or not update.message:
        return
    chat = update.effective_chat
    await update.message.reply_text(f"Chat ID: `{chat.id}`\nType: {chat.type}\nTitle: {chat.title or 'N/A'}", parse_mode="Markdown")


async def cb_main_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query or not query.data:
        return
    await query.answer()

    action = query.data.split(":")[1]
    tg_user = update.effective_user
    lang = "en"

    async with AsyncSessionLocal() as session:
        user = await get_user(session, tg_user.id)
        if user:
            lang = user.language

    if action == "daily":
        async with AsyncSessionLocal() as session:
            user = await get_user(session, tg_user.id)
            if not user:
                return
            lang = user.language
            claimed, _ = await claim_daily(session, user, DAILY_P)
            p_balance = user.p_balance
            streak = user.streak_days

        login_url = create_bot_login_url(tg_user.id, tg_user.first_name or "", tg_user.username or "")
        if claimed:
            text = t(lang, "daily_claimed", p=DAILY_P, streak=streak, p_balance=p_balance)
        else:
            text = t(lang, "daily_already", p_balance=p_balance)
        await query.edit_message_text(text, parse_mode="Markdown", reply_markup=main_menu(lang, login_url=login_url))

    elif action == "predict":
        from handlers.predict import show_match_list
        await show_match_list(update, context)

    elif action == "ranking":
        from handlers.ranking import show_ranking
        await show_ranking(update, context)

    elif action == "profile":
        login_url = create_bot_login_url(tg_user.id, tg_user.first_name or "", tg_user.username or "")
        async with AsyncSessionLocal() as session:
            user = await get_user(session, tg_user.id)
            if not user:
                return
            lang = user.language
            preds = await get_user_predictions_with_matches(session, user.id)
            history_text = format_bet_history(preds, user, lang)
        await query.edit_message_text(
            history_text,
            parse_mode="Markdown",
            reply_markup=main_menu(lang, login_url=login_url),
        )
