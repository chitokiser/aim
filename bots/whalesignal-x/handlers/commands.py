"""All bot command and callback query handlers."""
import json
import logging
import time
import jwt as pyjwt
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes, CommandHandler, CallbackQueryHandler
from database import db
from collectors import CATEGORY_MAP, ALL_COLLECTORS
from services.ai_service import pick_today_opportunity, generate_daily_digest
from utils.keyboards import (
    main_menu_keyboard, category_keyboard, back_keyboard,
    pro_feature_keyboard, community_keyboard,
)
from utils.formatters import (
    format_opportunity_list, format_funding, format_grant, format_hackathon,
    format_airdrop, format_testnet, format_listing, format_smart_money,
    format_github, format_social, format_dao, format_jobs, format_government,
    format_hidden_gem, format_ecosystem, format_today_pick, whale_score_badge,
)
from config import FREE_DAILY_LIMIT, AI119_COMMUNITY_URL, AIM_SITE_URL, JWT_SECRET

logger = logging.getLogger(__name__)


def _create_login_token(telegram_id: int, first_name: str = "", username: str = "") -> str:
    now = int(time.time())
    payload = {
        "telegramId": str(telegram_id),
        "type": "bot-login",
        "firstName": first_name,
        "username": username,
        "iat": now,
        "exp": now + 3600,
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm="HS256")

FORMATTER_MAP = {
    "funding": format_funding,
    "grant": format_grant,
    "hackathon": format_hackathon,
    "airdrop": format_airdrop,
    "testnet": format_testnet,
    "listings": format_listing,
    "smartmoney": format_smart_money,
    "github": format_github,
    "social": format_social,
    "dao": format_dao,
    "jobs": format_jobs,
    "gov": format_government,
    "hidden": format_hidden_gem,
    "gamefi": lambda d: format_ecosystem("gamefi", d),
    "nft": lambda d: format_ecosystem("nft", d),
    "depin": lambda d: format_ecosystem("depin", d),
    "rwa": lambda d: format_ecosystem("rwa", d),
    "etf": lambda d: format_ecosystem("etf", d),
}

CATEGORY_TITLES = {
    "funding": "💰 최신 펀딩 & 투자 유치",
    "grant": "💰 그랜트 프로그램",
    "hackathon": "🏆 해커톤",
    "airdrop": "🎁 에어드랍",
    "testnet": "🧪 테스트넷",
    "listings": "📈 거래소 상장",
    "smartmoney": "🐳 스마트머니",
    "github": "👨‍💻 GitHub 활동",
    "social": "🔥 소셜 급성장",
    "dao": "🏛 DAO Treasury",
    "jobs": "💼 채용 급증",
    "gov": "🏦 정부 지원사업",
    "gamefi": "🎮 GameFi",
    "nft": "🖼 NFT",
    "depin": "📡 DePIN",
    "rwa": "🏢 RWA",
    "etf": "📊 ETF/기관자금",
    "hidden": "💎 Hidden Gem",
    "news": "📰 뉴스 감성",
}


async def _ensure_user(update: Update) -> dict:
    user = update.effective_user
    await db.upsert_user(user.id, user.username or "", user.full_name or "")
    return await db.get_user(user.id)


async def _check_quota(update: Update, user_data: dict) -> bool:
    allowed = await db.check_and_increment_query(user_data["user_id"])
    if not allowed:
        plan = user_data.get("subscription", "free")
        await update.effective_message.reply_text(
            f"📊 *오늘의 무료 조회 한도 ({FREE_DAILY_LIMIT}회)를 초과했습니다.*\n\n"
            f"⭐ Pro/VIP로 업그레이드하면 무제한 조회 + 실시간 알림을 받을 수 있습니다!\n\n"
            f"/subscribe 명령어로 업그레이드하세요.",
            parse_mode="Markdown",
            reply_markup=pro_feature_keyboard(),
        )
        return False
    return True


async def _fetch_and_display(update: Update, category: str, live: bool = False):
    msg = update.effective_message
    loading = await msg.reply_text("🔍 데이터 수집 중...")

    opps = []
    if live or category in ("hidden", "news"):
        collectors = CATEGORY_MAP.get(category, [])
        for collector in collectors:
            try:
                new_opps = await collector.collect()
                filtered = [o for o in new_opps if o.category == category or category in ("hidden", "news")]
                opps.extend(filtered)
                for opp in new_opps:
                    if opp.whale_score >= 60:
                        await db.save_opportunity(
                            opp.category, opp.title, opp.summary,
                            opp.source_url, opp.whale_score, opp.raw_data,
                        )
            except Exception as e:
                logger.error(f"Live collect error {category}: {e}")
    else:
        db_opps = await db.get_opportunities(category=category, limit=10, min_score=0)
        if db_opps:
            opps = db_opps
        else:
            collectors = CATEGORY_MAP.get(category, [])
            for collector in collectors:
                try:
                    new_opps = await collector.collect()
                    opps.extend(new_opps)
                    for opp in new_opps:
                        if opp.whale_score >= 60:
                            await db.save_opportunity(
                                opp.category, opp.title, opp.summary,
                                opp.source_url, opp.whale_score, opp.raw_data,
                            )
                except Exception as e:
                    logger.error(f"Collect error {category}: {e}")

    await loading.delete()

    title = CATEGORY_TITLES.get(category, category.upper())
    formatter = FORMATTER_MAP.get(category)

    if not opps:
        await msg.reply_text(
            f"{title}\n\n📭 현재 해당 카테고리에 데이터가 없습니다.\n잠시 후 다시 확인해주세요.",
            reply_markup=category_keyboard(category),
        )
        return

    if formatter and hasattr(opps[0], "raw_data"):
        best = max(opps, key=lambda x: x.whale_score if hasattr(x, "whale_score") else x.get("whale_score", 0))
        raw = best.raw_data if hasattr(best, "raw_data") else json.loads(best.get("raw_data", "{}"))
        text = f"*{title}*\n\n" + formatter(raw)
    elif formatter:
        best = max(opps, key=lambda x: x.get("whale_score", 0))
        raw = json.loads(best.get("raw_data", "{}"))
        text = f"*{title}*\n\n" + formatter(raw)
    else:
        opp_dicts = [
            {"title": o.title, "whale_score": o.whale_score, "created_at": ""}
            if hasattr(o, "title") else o
            for o in opps
        ]
        text = f"*{title}*\n\n" + format_opportunity_list(opp_dicts)

    if len(opps) > 1:
        total_shown = min(len(opps), 10)
        text += f"\n\n_총 {total_shown}개 신호 중 최고 점수 표시 중_"

    await msg.reply_text(
        text,
        parse_mode="Markdown",
        reply_markup=category_keyboard(category),
        disable_web_page_preview=True,
    )


async def start_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_data = await _ensure_user(update)
    tg_user = update.effective_user
    name = tg_user.first_name or "Whale Hunter"
    is_private = update.effective_chat.type == "private"

    text = (
        f"🐋 *WhaleSignal X에 오신 것을 환영합니다, {name}님!*\n\n"
        f"*Follow The Money* — 돈이 흐르는 곳에 기회가 있다\n\n"
        f"AI가 전 세계 투자금, 그랜트, 에어드랍, 해커톤,\n"
        f"스마트머니, 채용, 정부지원금을 실시간 추적합니다.\n\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"🎁 무료 플랜: 하루 {FREE_DAILY_LIMIT}회 조회\n"
        f"⭐ Pro ($9.99/월): 실시간 알림 + 무제한\n"
        f"👑 VIP ($29.99/월): API + 조기 신호\n"
        f"━━━━━━━━━━━━━━━━━━━━\n\n"
        f"아래 메뉴를 선택하거나 명령어를 입력하세요."
    )

    if is_private:
        login_token = _create_login_token(
            tg_user.id,
            first_name=tg_user.first_name or "",
            username=tg_user.username or "",
        )
        keyboard = InlineKeyboardMarkup([
            [
                InlineKeyboardButton("🚀 AI119 플랫폼 입장", web_app={"url": f"{AIM_SITE_URL}?tg={login_token}"}),
                InlineKeyboardButton("💬 AI119 커뮤니티", url=AI119_COMMUNITY_URL),
            ],
        ])
    else:
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("💬 AI119 커뮤니티", url=AI119_COMMUNITY_URL)],
        ])

    await update.message.reply_text(
        text, parse_mode="Markdown", reply_markup=keyboard
    )


async def help_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = (
        "📖 *WhaleSignal X 명령어 목록*\n\n"
        "💰 `/funding` — 투자 유치 & 펀딩\n"
        "💰 `/grants` — 그랜트 프로그램\n"
        "🏆 `/hackathon` — 해커톤\n"
        "🎁 `/airdrop` — 에어드랍\n"
        "🧪 `/testnet` — 테스트넷\n"
        "📈 `/listings` — 거래소 상장\n"
        "🐳 `/smartmoney` — 스마트머니\n"
        "👨‍💻 `/github` — GitHub 활동\n"
        "🔥 `/social` — 소셜 급성장\n"
        "🏛 `/dao` — DAO Treasury\n"
        "💼 `/jobs` — 채용 급증\n"
        "🏦 `/gov` — 정부 지원사업\n"
        "🎮 `/gamefi` — GameFi\n"
        "🖼 `/nft` — NFT\n"
        "📡 `/depin` — DePIN\n"
        "🏢 `/rwa` — RWA\n"
        "📊 `/etf` — ETF/기관자금\n"
        "💎 `/hidden` — Hidden Gem ⭐Pro\n"
        "🎯 `/top` — Top 5 기회\n"
        "📅 `/calendar` — 오늘의 캘린더\n"
        "⭐ `/subscribe` — 구독 관리\n"
    )
    await update.message.reply_text(
        text, parse_mode="Markdown", reply_markup=community_keyboard()
    )


async def top_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_data = await _ensure_user(update)
    if not await _check_quota(update, user_data):
        return

    msg = update.effective_message
    loading = await msg.reply_text("🔍 Top 기회 분석 중...")

    opps = await db.get_top_opportunities(limit=5)
    await loading.delete()

    if not opps:
        await msg.reply_text(
            "🎯 *Top 5 Opportunities*\n\n"
            "📭 아직 충분한 데이터가 없습니다.\n"
            "잠시 후 다시 시도해주세요.",
            reply_markup=back_keyboard(),
        )
        return

    today_pick_data = await pick_today_opportunity(opps)

    lines = ["🎯 *TODAY'S TOP OPPORTUNITIES*\n"]
    for i, opp in enumerate(opps, 1):
        score = opp.get("whale_score", 0)
        badge = whale_score_badge(score)
        lines.append(
            f"{i}\\. *{opp.get('title', '')[:60]}*\n"
            f"   Category: `{opp.get('category', '').upper()}`\n"
            f"   WhaleScore: {score} {badge}\n"
        )

    if today_pick_data:
        lines.append("\n" + format_today_pick(today_pick_data))

    lines.append("\n⚠️ _투자 권유가 아닌 리서치 우선순위입니다._")
    await msg.reply_text(
        "\n".join(lines),
        parse_mode="Markdown",
        reply_markup=back_keyboard(),
        disable_web_page_preview=True,
    )


async def calendar_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_data = await _ensure_user(update)
    if not await _check_quota(update, user_data):
        return

    opps = await db.get_opportunities(limit=5, min_score=70)
    text = "📅 *오늘의 WhaleSignal 캘린더*\n\n"

    if opps:
        for opp in opps:
            date = opp.get("created_at", "")[:10]
            text += f"• [{opp.get('category', '').upper()}] {opp.get('title', '')[:50]}\n  📅 {date}\n\n"
    else:
        text += "📭 오늘 등록된 이벤트가 없습니다."

    await update.effective_message.reply_text(
        text, parse_mode="Markdown", reply_markup=back_keyboard()
    )


async def subscribe_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_data = await _ensure_user(update)
    plan = user_data.get("subscription", "free")
    expires = user_data.get("sub_expires_at", "N/A")

    text = (
        "⭐ *WhaleSignal X 구독 플랜*\n\n"
        f"현재 플랜: *{plan.upper()}*\n"
        f"만료일: {expires[:10] if expires and expires != 'N/A' else 'N/A'}\n\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        "🆓 *Free* (현재)\n"
        f"  ✅ 하루 {FREE_DAILY_LIMIT}회 조회\n"
        "  ✅ 기본 카테고리 접근\n\n"
        "⭐ *Pro — $9.99/월*\n"
        "  ✅ 무제한 조회\n"
        "  ✅ 실시간 고점수 알림 (WhaleScore 80+)\n"
        "  ✅ Hidden Gem 접근\n"
        "  ✅ 일일 AI 브리핑\n"
        "  ✅ Smart Money 상세 분석\n\n"
        "👑 *VIP — $29.99/월*\n"
        "  ✅ Pro 모든 기능\n"
        "  ✅ API 접근\n"
        "  ✅ 조기 신호 알림 (5분 선행)\n"
        "  ✅ 커스텀 WhaleScore 필터\n"
        "  ✅ 전담 지원\n\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        "💳 결제: USDT/TON/Telegram Stars\n"
        "📩 구독 문의: @ai119_admin"
    )
    from utils.keyboards import subscription_keyboard
    await update.effective_message.reply_text(
        text, parse_mode="Markdown", reply_markup=subscription_keyboard()
    )


async def generic_category_handler(category: str):
    async def handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
        user_data = await _ensure_user(update)
        if category in ("hidden", "smartmoney") and user_data.get("subscription", "free") == "free":
            await update.effective_message.reply_text(
                f"⭐ *이 기능은 Pro/VIP 전용입니다.*\n\n"
                f"Hidden Gem & Smart Money 분석은 유료 구독 전용 기능입니다.\n"
                f"/subscribe 로 업그레이드하세요.",
                parse_mode="Markdown",
                reply_markup=pro_feature_keyboard(),
            )
            return
        if not await _check_quota(update, user_data):
            return
        await _fetch_and_display(update, category)
    return handler


async def callback_query_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    data = query.data

    if data == "cmd_menu":
        await query.message.edit_text(
            "🐋 *WhaleSignal X* — Follow The Money\n\n메뉴를 선택하세요:",
            parse_mode="Markdown",
            reply_markup=main_menu_keyboard(),
        )
        return

    if data == "cmd_subscribe" or data in ("sub_pro", "sub_vip", "sub_status"):
        await subscribe_handler(update, context)
        return

    if data.startswith("cmd_"):
        category = data[4:]
        user_data = await _ensure_user(update)
        if category in ("hidden", "smartmoney") and user_data.get("subscription", "free") == "free":
            await query.message.reply_text(
                "⭐ 이 기능은 Pro/VIP 전용입니다.\n/subscribe 로 업그레이드하세요.",
                reply_markup=pro_feature_keyboard(),
            )
            return
        if not await _check_quota(update, user_data):
            return
        await _fetch_and_display(update, category)


