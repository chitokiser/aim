"""Main command handlers."""

from telegram import Update
from telegram.ext import ContextTypes
from telegram.constants import ParseMode

from database import upsert_subscriber, get_subscriber
from services.ai_service import generate_hustle_idea, format_hustle_message, analyze_trends
from services.market_service import get_market_brief, get_crypto_brief, get_gold_price, get_stock_info
from utils.keyboards import with_partner, refresh_keyboard


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat = update.effective_chat
    user = update.effective_user
    is_group = chat.type in ("group", "supergroup")

    await upsert_subscriber(
        chat_id=chat.id,
        username=user.username if user else None,
        first_name=user.first_name if user else chat.title,
        is_group=is_group,
    )

    name = chat.title if is_group else (user.first_name if user else "")
    greeting = f"그룹 *{name}*" if is_group else f"*{name}*님"

    text = (
        f"💰 *AI Money Hunter Bot*에 오신 것을 환영합니다, {greeting}!\n\n"
        "🤖 저는 AI가 분석한 최신 돈벌이 기회와 글로벌 시장 정보를 매일 제공합니다.\n\n"
        "📋 *주요 명령어*\n"
        "/today — 오늘의 돈벌이 아이디어\n"
        "/market — 글로벌 시장 현황\n"
        "/crypto — 암호화폐 시세\n"
        "/gold — 금값 조회\n"
        "/stock 삼성전자 — 특정 종목 조회\n"
        "/trend — AI 트렌드 분석\n"
        "/subscribe — 자동 알림 구독\n"
        "/unsubscribe — 알림 해제\n\n"
        "⏰ *자동 브리핑*\n"
        "• 매일 오전 9시: 오늘의 돈벌이 아이디어\n"
        "• 매일 오후 6시: 글로벌 시장 브리핑"
    )

    await update.message.reply_text(text, parse_mode=ParseMode.MARKDOWN, reply_markup=with_partner())


async def cmd_today(update: Update, context: ContextTypes.DEFAULT_TYPE):
    msg = await update.message.reply_text("🔍 AI가 오늘의 기회를 분석 중입니다...")
    try:
        idea = await generate_hustle_idea()
        text = format_hustle_message(idea)
        await msg.edit_text(
            text,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=refresh_keyboard("refresh_today"),
        )
    except Exception as e:
        await msg.edit_text(f"❌ 분석 중 오류가 발생했습니다: {e}")


async def cmd_market(update: Update, context: ContextTypes.DEFAULT_TYPE):
    msg = await update.message.reply_text("📡 시장 데이터를 불러오는 중...")
    try:
        text = await get_market_brief()
        await msg.edit_text(
            text,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=refresh_keyboard("refresh_market"),
        )
    except Exception as e:
        await msg.edit_text(f"❌ 오류: {e}")


async def cmd_crypto(update: Update, context: ContextTypes.DEFAULT_TYPE):
    msg = await update.message.reply_text("📡 암호화폐 데이터를 불러오는 중...")
    try:
        text = await get_crypto_brief()
        await msg.edit_text(
            text,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=refresh_keyboard("refresh_crypto"),
        )
    except Exception as e:
        await msg.edit_text(f"❌ 오류: {e}")


async def cmd_gold(update: Update, context: ContextTypes.DEFAULT_TYPE):
    msg = await update.message.reply_text("📡 금값 데이터를 불러오는 중...")
    try:
        text = await get_gold_price()
        await msg.edit_text(
            text,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=refresh_keyboard("refresh_gold"),
        )
    except Exception as e:
        await msg.edit_text(f"❌ 오류: {e}")


async def cmd_stock(update: Update, context: ContextTypes.DEFAULT_TYPE):
    args = context.args
    if not args:
        await update.message.reply_text(
            "📊 종목명 또는 티커를 입력하세요.\n예시: `/stock 삼성전자` 또는 `/stock AAPL`",
            parse_mode=ParseMode.MARKDOWN,
        )
        return

    query = " ".join(args)
    msg = await update.message.reply_text(f"📡 *{query}* 데이터를 불러오는 중...", parse_mode=ParseMode.MARKDOWN)
    try:
        text = await get_stock_info(query)
        await msg.edit_text(text, parse_mode=ParseMode.MARKDOWN, reply_markup=with_partner())
    except Exception as e:
        await msg.edit_text(f"❌ 오류: {e}")


async def cmd_trend(update: Update, context: ContextTypes.DEFAULT_TYPE):
    msg = await update.message.reply_text("🧠 AI 트렌드를 분석 중입니다...")
    try:
        text = await analyze_trends()
        await msg.edit_text(
            text,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=refresh_keyboard("refresh_trend"),
        )
    except Exception as e:
        await msg.edit_text(f"❌ 오류: {e}")


async def callback_refresh(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle inline button refresh callbacks."""
    query = update.callback_query
    await query.answer()
    data = query.data

    handlers = {
        "refresh_today": _refresh_today,
        "refresh_market": _refresh_market,
        "refresh_crypto": _refresh_crypto,
        "refresh_gold": _refresh_gold,
        "refresh_trend": _refresh_trend,
    }

    handler = handlers.get(data)
    if handler:
        await handler(query)


async def _refresh_today(query):
    await query.edit_message_text("🔍 AI가 재분석 중입니다...")
    idea = await generate_hustle_idea()
    text = format_hustle_message(idea)
    await query.edit_message_text(
        text,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=refresh_keyboard("refresh_today"),
    )


async def _refresh_market(query):
    await query.edit_message_text("📡 시장 데이터 새로고침 중...")
    text = await get_market_brief()
    await query.edit_message_text(
        text,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=refresh_keyboard("refresh_market"),
    )


async def _refresh_crypto(query):
    await query.edit_message_text("📡 암호화폐 데이터 새로고침 중...")
    text = await get_crypto_brief()
    await query.edit_message_text(
        text,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=refresh_keyboard("refresh_crypto"),
    )


async def _refresh_gold(query):
    await query.edit_message_text("📡 금값 데이터 새로고침 중...")
    text = await get_gold_price()
    await query.edit_message_text(
        text,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=refresh_keyboard("refresh_gold"),
    )


async def _refresh_trend(query):
    await query.edit_message_text("🧠 AI 트렌드 재분석 중...")
    text = await analyze_trends()
    await query.edit_message_text(
        text,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=refresh_keyboard("refresh_trend"),
    )
