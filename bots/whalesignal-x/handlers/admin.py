"""Admin-only command handlers."""
import logging
from telegram import Update
from telegram.ext import ContextTypes, CommandHandler
from database import db
from collectors import ALL_COLLECTORS
from services.scheduler_service import collect_all, send_group_broadcast
from utils.keyboards import community_keyboard
from config import ADMIN_IDS, GROUP_CHAT_ID

logger = logging.getLogger(__name__)


def admin_only(func):
    async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE):
        if update.effective_user.id not in ADMIN_IDS:
            await update.message.reply_text("⛔ 관리자 전용 명령어입니다.")
            return
        return await func(update, context)
    return wrapper


@admin_only
async def admin_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    group_status = f"`{GROUP_CHAT_ID}`" if GROUP_CHAT_ID else "❌ 미설정"
    text = (
        "🔧 *WhaleSignal X — 관리자 패널*\n\n"
        "/stats — 통계 보기\n"
        "/users — 사용자 목록\n"
        "/broadcast <메시지> — 전체 공지\n"
        "/trending — 인기 기회 보기\n"
        "/collect — 즉시 데이터 수집\n"
        "/groupcast — 그룹 생중계 즉시 발송\n"
        "/groupcast evening — 저녁 슬롯으로 발송\n"
        "/setpro <user_id> — Pro 구독 설정\n"
        "/setvip <user_id> — VIP 구독 설정\n"
        "/setfree <user_id> — Free로 변경\n\n"
        f"📡 그룹 채팅: {group_status}"
    )
    await update.message.reply_text(text, parse_mode="Markdown")


@admin_only
async def stats_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    stats = await db.get_stats()
    text = (
        f"📊 *WhaleSignal X 통계*\n\n"
        f"👥 총 사용자: {stats['total_users']:,}\n"
        f"⭐ Pro 구독: {stats['pro_users']:,}\n"
        f"👑 VIP 구독: {stats['vip_users']:,}\n"
        f"💰 수집된 기회: {stats['total_opportunities']:,}\n"
    )
    await update.message.reply_text(text, parse_mode="Markdown")


@admin_only
async def users_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    users = await db.get_all_users()
    if not users:
        await update.message.reply_text("사용자 없음")
        return
    lines = ["👥 *사용자 목록*\n"]
    for u in users[:20]:
        plan = u.get("subscription", "free").upper()
        name = u.get("full_name") or u.get("username") or str(u.get("user_id"))
        lines.append(f"• `{u['user_id']}` {name} [{plan}]")
    if len(users) > 20:
        lines.append(f"\n... 및 {len(users) - 20}명 더")
    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


@admin_only
async def broadcast_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        await update.message.reply_text("사용법: /broadcast <메시지>")
        return
    message = " ".join(context.args)
    users = await db.get_all_users()
    sent = 0
    failed = 0
    for user in users:
        try:
            await context.bot.send_message(
                chat_id=user["user_id"],
                text=f"📢 *공지사항*\n\n{message}",
                parse_mode="Markdown",
                reply_markup=community_keyboard(),
            )
            sent += 1
        except Exception:
            failed += 1
    await update.message.reply_text(f"✅ 발송 완료: {sent}명 성공, {failed}명 실패")


@admin_only
async def trending_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    opps = await db.get_top_opportunities(limit=10)
    if not opps:
        await update.message.reply_text("인기 기회 없음")
        return
    lines = ["🔥 *인기 기회 Top 10*\n"]
    for i, opp in enumerate(opps, 1):
        lines.append(
            f"{i}. [{opp.get('category', '').upper()}] {opp.get('title', '')[:50]}\n"
            f"   Score: {opp.get('whale_score', 0)}"
        )
    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


@admin_only
async def collect_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    msg = await update.message.reply_text("🔍 데이터 수집 시작...")
    await collect_all()
    stats = await db.get_stats()
    await msg.edit_text(
        f"✅ 수집 완료!\n총 기회: {stats['total_opportunities']:,}개"
    )


@admin_only
async def groupcast_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not GROUP_CHAT_ID:
        await update.message.reply_text("❌ GROUP_CHAT_ID가 .env에 설정되지 않았습니다.")
        return

    slot = (context.args[0].lower() if context.args else "morning")
    if slot not in ("morning", "evening"):
        await update.message.reply_text("사용법: /groupcast [morning|evening]")
        return

    slot_label = "아침" if slot == "morning" else "저녁"
    msg = await update.message.reply_text(f"📡 {slot_label} 생중계 발송 중...")
    try:
        await send_group_broadcast(slot)
        await msg.edit_text(f"✅ {slot_label} 생중계 발송 완료! → 채팅 {GROUP_CHAT_ID}")
    except Exception as e:
        await msg.edit_text(f"❌ 발송 실패: {e}")


async def set_subscription_handler(plan: str):
    @admin_only
    async def handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not context.args:
            await update.message.reply_text(f"사용법: /set{plan} <user_id>")
            return
        try:
            target_id = int(context.args[0])
        except ValueError:
            await update.message.reply_text("올바른 user_id를 입력하세요.")
            return
        days = 30 if plan in ("pro", "vip") else 0
        if plan == "free":
            await db._execute(
                "UPDATE users SET subscription='free', sub_expires_at=NULL WHERE user_id=?",
                (target_id,),
            )
        else:
            await db.set_subscription(target_id, plan, days, payment_ref="admin_grant")
        await update.message.reply_text(f"✅ user {target_id}를 {plan.upper()}으로 변경했습니다.")
        try:
            plan_names = {"pro": "⭐ Pro", "vip": "👑 VIP", "free": "🆓 Free"}
            await context.bot.send_message(
                chat_id=target_id,
                text=f"🎉 *구독이 활성화되었습니다!*\n\n플랜: *{plan_names.get(plan, plan)}*\n\n/start 으로 시작하세요.",
                parse_mode="Markdown",
                reply_markup=community_keyboard(),
            )
        except Exception:
            pass
    return handler


def register_admin_handlers(app):
    app.add_handler(CommandHandler("admin", admin_handler))
    app.add_handler(CommandHandler("stats", stats_handler))
    app.add_handler(CommandHandler("users", users_handler))
    app.add_handler(CommandHandler("broadcast", broadcast_handler))
    app.add_handler(CommandHandler("trending", trending_handler))
    app.add_handler(CommandHandler("collect", collect_handler))
