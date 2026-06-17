"""Subscribe / unsubscribe handlers."""

from telegram import Update
from telegram.ext import ContextTypes
from telegram.constants import ParseMode

from database import upsert_subscriber, set_subscribed, get_subscriber
from utils.keyboards import with_partner


async def cmd_subscribe(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat = update.effective_chat
    user = update.effective_user
    is_group = chat.type in ("group", "supergroup")

    await upsert_subscriber(
        chat_id=chat.id,
        username=user.username if user else None,
        first_name=user.first_name if user else chat.title,
        is_group=is_group,
    )

    sub = await get_subscriber(chat.id)
    if sub and sub.subscribed:
        await update.message.reply_text(
            "✅ 이미 알림을 구독 중입니다!\n\n"
            "⏰ 매일 오전 9시 돈벌이 아이디어 + 오후 6시 시장 브리핑을 받으실 거예요.",
            reply_markup=with_partner(),
        )
        return

    await set_subscribed(chat.id, True)
    await update.message.reply_text(
        "🔔 *알림 구독 완료!*\n\n"
        "⏰ 매일 받게 될 정보:\n"
        "• 오전 9시: 오늘의 돈벌이 아이디어\n"
        "• 오후 6시: 글로벌 시장 브리핑\n\n"
        "알림을 끄려면 /unsubscribe 를 사용하세요.",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=with_partner(),
    )


async def cmd_unsubscribe(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat = update.effective_chat
    await set_subscribed(chat.id, False)
    await update.message.reply_text(
        "🔕 알림이 해제되었습니다.\n\n다시 구독하려면 /subscribe 를 사용하세요.",
        reply_markup=with_partner(),
    )
