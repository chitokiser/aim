"""Subscribe / unsubscribe handlers."""

from telegram import Update
from telegram.ext import ContextTypes
from telegram.constants import ParseMode

from database import upsert_subscriber, set_subscribed, get_subscriber
from i18n import detect_lang, t
from utils.keyboards import with_partner


async def cmd_subscribe(update: Update, context: ContextTypes.DEFAULT_TYPE):
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

    sub = await get_subscriber(chat.id)
    if sub and sub.subscribed:
        await update.message.reply_text(
            t(lang, "subscribe_already"),
            reply_markup=with_partner(lang),
        )
        return

    await set_subscribed(chat.id, True)
    await update.message.reply_text(
        t(lang, "subscribe_success"),
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=with_partner(lang),
    )


async def cmd_unsubscribe(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat = update.effective_chat
    user = update.effective_user
    lang = detect_lang(user.language_code if user else None)
    await set_subscribed(chat.id, False)
    await update.message.reply_text(
        t(lang, "unsubscribe_success"),
        reply_markup=with_partner(lang),
    )
