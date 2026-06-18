"""Main command handlers."""

from telegram import Update
from telegram.ext import ContextTypes
from telegram.constants import ParseMode

from database import upsert_subscriber, get_subscriber
from i18n import detect_lang, t
from services.ai_service import generate_hustle_idea, format_hustle_message, analyze_trends
from services.market_service import get_market_brief, get_crypto_brief, get_gold_price, get_stock_info
from utils.keyboards import with_partner, refresh_keyboard


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat = update.effective_chat
    user = update.effective_user
    is_group = chat.type in ("group", "supergroup")
    lang = detect_lang(user.language_code if user else None)

    await upsert_subscriber(
        chat_id=chat.id,
        username=user.username if user else None,
        first_name=user.first_name if user else chat.title,
        is_group=is_group,
    )

    name = chat.title if is_group else (user.first_name if user else "")
    key = "welcome_group" if is_group else "welcome_user"
    text = t(lang, key, name=name)

    await update.message.reply_text(text, parse_mode=ParseMode.MARKDOWN, reply_markup=with_partner(lang))


async def cmd_today(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    lang = detect_lang(user.language_code if user else None)
    msg = await update.message.reply_text(t(lang, "analyzing"))
    try:
        idea = await generate_hustle_idea()
        text = format_hustle_message(idea)
        await msg.edit_text(
            text,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=refresh_keyboard("refresh_today", lang),
        )
    except Exception as e:
        await msg.edit_text(t(lang, "error", e=e))


async def cmd_market(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    lang = detect_lang(user.language_code if user else None)
    msg = await update.message.reply_text(t(lang, "loading_market"))
    try:
        text = await get_market_brief()
        await msg.edit_text(
            text,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=refresh_keyboard("refresh_market", lang),
        )
    except Exception as e:
        await msg.edit_text(t(lang, "error", e=e))


async def cmd_crypto(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    lang = detect_lang(user.language_code if user else None)
    msg = await update.message.reply_text(t(lang, "loading_crypto"))
    try:
        text = await get_crypto_brief()
        await msg.edit_text(
            text,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=refresh_keyboard("refresh_crypto", lang),
        )
    except Exception as e:
        await msg.edit_text(t(lang, "error", e=e))


async def cmd_gold(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    lang = detect_lang(user.language_code if user else None)
    msg = await update.message.reply_text(t(lang, "loading_gold"))
    try:
        text = await get_gold_price()
        await msg.edit_text(
            text,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=refresh_keyboard("refresh_gold", lang),
        )
    except Exception as e:
        await msg.edit_text(t(lang, "error", e=e))


async def cmd_stock(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    lang = detect_lang(user.language_code if user else None)
    args = context.args
    if not args:
        await update.message.reply_text(
            t(lang, "stock_usage"),
            parse_mode=ParseMode.MARKDOWN,
        )
        return

    query = " ".join(args)
    msg = await update.message.reply_text(t(lang, "loading_stock", query=query), parse_mode=ParseMode.MARKDOWN)
    try:
        text = await get_stock_info(query)
        await msg.edit_text(text, parse_mode=ParseMode.MARKDOWN, reply_markup=with_partner(lang))
    except Exception as e:
        await msg.edit_text(t(lang, "error", e=e))


async def cmd_trend(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    lang = detect_lang(user.language_code if user else None)
    msg = await update.message.reply_text(t(lang, "loading_trend"))
    try:
        text = await analyze_trends()
        await msg.edit_text(
            text,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=refresh_keyboard("refresh_trend", lang),
        )
    except Exception as e:
        await msg.edit_text(t(lang, "error", e=e))


async def callback_refresh(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle inline button refresh callbacks."""
    query = update.callback_query
    await query.answer()
    data = query.data
    user = update.effective_user
    lang = detect_lang(user.language_code if user else None)

    handlers = {
        "refresh_today": _refresh_today,
        "refresh_market": _refresh_market,
        "refresh_crypto": _refresh_crypto,
        "refresh_gold": _refresh_gold,
        "refresh_trend": _refresh_trend,
    }

    handler = handlers.get(data)
    if handler:
        await handler(query, lang)


async def _refresh_today(query, lang: str):
    await query.edit_message_text(t(lang, "refreshing"))
    idea = await generate_hustle_idea()
    text = format_hustle_message(idea)
    await query.edit_message_text(
        text,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=refresh_keyboard("refresh_today", lang),
    )


async def _refresh_market(query, lang: str):
    await query.edit_message_text(t(lang, "refreshing_market"))
    text = await get_market_brief()
    await query.edit_message_text(
        text,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=refresh_keyboard("refresh_market", lang),
    )


async def _refresh_crypto(query, lang: str):
    await query.edit_message_text(t(lang, "refreshing_crypto"))
    text = await get_crypto_brief()
    await query.edit_message_text(
        text,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=refresh_keyboard("refresh_crypto", lang),
    )


async def _refresh_gold(query, lang: str):
    await query.edit_message_text(t(lang, "refreshing_gold"))
    text = await get_gold_price()
    await query.edit_message_text(
        text,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=refresh_keyboard("refresh_gold", lang),
    )


async def _refresh_trend(query, lang: str):
    await query.edit_message_text(t(lang, "refreshing_trend"))
    text = await analyze_trends()
    await query.edit_message_text(
        text,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=refresh_keyboard("refresh_trend", lang),
    )
