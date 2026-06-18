"""Admin-only commands."""

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from telegram.constants import ParseMode

from config import ADMIN_IDS
from database import get_active_subscribers, get_stats, log_broadcast
from utils.keyboards import with_partner


def admin_only(func):
    async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE):
        user = update.effective_user
        if not user or user.id not in ADMIN_IDS:
            await update.message.reply_text("⛔ 관리자 전용 명령어입니다.")
            return
        return await func(update, context)
    return wrapper


@admin_only
async def cmd_admin(update: Update, context: ContextTypes.DEFAULT_TYPE):
    stats = await get_stats()
    text = (
        f"🛠 *관리자 패널*\n\n"
        f"👥 전체 구독자: {stats['total']}\n"
        f"✅ 활성 구독자: {stats['active']}\n"
        f"🏠 그룹 수: {stats['groups']}\n\n"
        f"*명령어*\n"
        f"/broadcast <메시지> — 전체 공지 발송\n"
        f"/stats — 사용자 통계\n"
        f"/admin — 이 패널"
    )
    await update.message.reply_text(text, parse_mode=ParseMode.MARKDOWN)


@admin_only
async def cmd_stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    stats = await get_stats()
    text = (
        f"📊 *사용자 통계*\n\n"
        f"전체: {stats['total']}명\n"
        f"활성: {stats['active']}명\n"
        f"그룹: {stats['groups']}개\n"
        f"개인: {stats['active'] - stats['groups']}명"
    )
    await update.message.reply_text(text, parse_mode=ParseMode.MARKDOWN)


@admin_only
async def cmd_broadcast(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        await update.message.reply_text("사용법: /broadcast <메시지 내용>")
        return

    message = " ".join(context.args)
    text = f"📢 *공지사항*\n\n{message}"

    subscribers = await get_active_subscribers()
    success = 0
    fail = 0

    for sub in subscribers:
        try:
            await context.bot.send_message(
                chat_id=sub.chat_id,
                text=text,
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=with_partner("ko"),
            )
            success += 1
        except Exception:
            fail += 1

    await log_broadcast("admin", text, success)
    await update.message.reply_text(
        f"✅ 발송 완료\n성공: {success}명\n실패: {fail}명"
    )
