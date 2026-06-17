"""Scheduled data collection and daily digest delivery."""
import asyncio
import logging
from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from telegram import Bot
from collectors import ALL_COLLECTORS
from database import db
from services.ai_service import generate_daily_digest, pick_today_opportunity, generate_group_broadcast
from utils.keyboards import community_keyboard, group_broadcast_keyboard
from utils.formatters import format_today_pick, format_group_stats
from config import (
    DAILY_DIGEST_HOUR, COLLECT_INTERVAL_MINUTES,
    GROUP_CHAT_ID, GROUP_BROADCAST_MORNING_HOUR, GROUP_BROADCAST_EVENING_HOUR,
)

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()
_bot: Bot = None


def init_scheduler(bot: Bot):
    global _bot
    _bot = bot

    scheduler.add_job(
        collect_all,
        IntervalTrigger(minutes=COLLECT_INTERVAL_MINUTES),
        id="collect_all",
        replace_existing=True,
    )

    scheduler.add_job(
        send_daily_digest,
        CronTrigger(hour=DAILY_DIGEST_HOUR, minute=0),
        id="daily_digest",
        replace_existing=True,
    )

    scheduler.add_job(
        notify_unsent_alerts,
        IntervalTrigger(minutes=15),
        id="notify_alerts",
        replace_existing=True,
    )

    if GROUP_CHAT_ID:
        scheduler.add_job(
            send_group_broadcast,
            CronTrigger(hour=GROUP_BROADCAST_MORNING_HOUR, minute=0),
            args=["morning"],
            id="group_broadcast_morning",
            replace_existing=True,
        )
        scheduler.add_job(
            send_group_broadcast,
            CronTrigger(hour=GROUP_BROADCAST_EVENING_HOUR, minute=0),
            args=["evening"],
            id="group_broadcast_evening",
            replace_existing=True,
        )
        logger.info(
            f"Group broadcast scheduled: {GROUP_BROADCAST_MORNING_HOUR:02d}:00 & "
            f"{GROUP_BROADCAST_EVENING_HOUR:02d}:00 UTC → chat {GROUP_CHAT_ID}"
        )
    else:
        logger.warning("GROUP_CHAT_ID not set — group broadcasts disabled")

    scheduler.start()
    logger.info("Scheduler started")


async def collect_all():
    logger.info("Starting data collection cycle...")
    total = 0
    for collector in ALL_COLLECTORS:
        try:
            opps = await collector.collect()
            for opp in opps:
                if opp.whale_score >= 60:
                    await db.save_opportunity(
                        category=opp.category,
                        title=opp.title,
                        summary=opp.summary,
                        source_url=opp.source_url,
                        whale_score=opp.whale_score,
                        raw_data=opp.raw_data,
                    )
                    total += 1
        except Exception as e:
            logger.error(f"Collector {collector.category} error: {e}")
    logger.info(f"Collection done: {total} opportunities saved")


async def send_daily_digest():
    if not _bot:
        return
    opps = await db.get_top_opportunities(limit=10)
    if not opps:
        return

    digest = await generate_daily_digest(opps)
    today_pick = await pick_today_opportunity(opps)

    pro_users = await db.get_pro_users()
    text = digest
    if today_pick:
        text += "\n\n" + format_today_pick(today_pick)

    text += "\n\n⚠️ _투자 권유가 아닌 리서치 참고 정보입니다._"

    for user in pro_users:
        try:
            await _bot.send_message(
                chat_id=user["user_id"],
                text=text,
                parse_mode="Markdown",
                reply_markup=community_keyboard(),
            )
            await asyncio.sleep(0.05)
        except Exception as e:
            logger.warning(f"Daily digest send error {user['user_id']}: {e}")


async def send_group_broadcast(slot: str):
    """Send a live status broadcast to the group chat (morning/evening)."""
    if not _bot or not GROUP_CHAT_ID:
        return

    try:
        opps = await db.get_top_opportunities(limit=10)
        all_opps = await db.get_opportunities(limit=200, min_score=60)

        by_category: dict = {}
        for o in (all_opps or []):
            cat = o.get("category", "other")
            by_category[cat] = by_category.get(cat, 0) + 1

        now_utc = datetime.now(timezone.utc)
        date_str = now_utc.strftime("%Y-%m-%d  %H:%M UTC")

        header = format_group_stats(slot, date_str, len(all_opps or []), by_category)
        body = await generate_group_broadcast(opps or [], slot)

        text = header + body

        await _bot.send_message(
            chat_id=GROUP_CHAT_ID,
            text=text,
            parse_mode="Markdown",
            reply_markup=group_broadcast_keyboard(),
            disable_web_page_preview=True,
        )
        logger.info(f"Group broadcast sent: slot={slot}, chat={GROUP_CHAT_ID}")
    except Exception as e:
        logger.error(f"Group broadcast error (slot={slot}): {e}")


async def notify_unsent_alerts():
    if not _bot:
        return
    unsent = await db.get_unsent_opportunities()
    if not unsent:
        return

    pro_users = await db.get_pro_users()
    if not pro_users:
        for opp in unsent:
            await db.mark_sent(opp["id"])
        return

    for opp in unsent[:5]:
        score = opp.get("whale_score", 0)
        if score < 80:
            await db.mark_sent(opp["id"])
            continue

        text = (
            f"🚨 *HIGH-SCORE ALERT*\n\n"
            f"**Category:** {opp.get('category', '').upper()}\n"
            f"**Title:** {opp.get('title', '')}\n"
            f"**WhaleScore:** {score}\n\n"
            f"📰 [자세히 보기]({opp.get('source_url', '#')})"
        )
        for user in pro_users:
            try:
                await _bot.send_message(
                    chat_id=user["user_id"],
                    text=text,
                    parse_mode="Markdown",
                    reply_markup=community_keyboard(),
                )
                await db.log_alert(user["user_id"], opp["id"])
                await asyncio.sleep(0.05)
            except Exception as e:
                logger.warning(f"Alert send error {user['user_id']}: {e}")
        await db.mark_sent(opp["id"])
