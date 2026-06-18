"""APScheduler: morning hustle broadcast + evening market broadcast + spike alerts."""

import logging
import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz

from telegram import Bot
from telegram.constants import ParseMode

from config import MORNING_HOUR, EVENING_HOUR, TIMEZONE
from database import get_active_subscribers, log_broadcast
from services.ai_service import generate_hustle_idea, format_hustle_message
from services.market_service import get_market_brief, get_crypto_brief, _fetch_ticker
from utils.keyboards import with_partner

logger = logging.getLogger(__name__)
tz = pytz.timezone(TIMEZONE)

# Previous prices for spike detection
_prev_prices: dict[str, float] = {}

SPIKE_TARGETS = {
    "BTC-USD": "Bitcoin",
    "ETH-USD": "Ethereum",
    "GC=F": "Gold",
    "^IXIC": "NASDAQ",
}


async def broadcast_morning(bot: Bot):
    """Send daily hustle idea to all active subscribers."""
    logger.info("Morning broadcast starting...")
    try:
        idea = await generate_hustle_idea()
        text = format_hustle_message(idea)
    except Exception as e:
        logger.error(f"Morning generation failed: {e}")
        return

    subscribers = await get_active_subscribers()
    success = 0
    for sub in subscribers:
        try:
            await bot.send_message(
                chat_id=sub.chat_id,
                text=text,
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=with_partner("ko"),
            )
            success += 1
            await asyncio.sleep(0.05)  # Avoid hitting rate limits
        except Exception as e:
            logger.warning(f"Failed to send morning to {sub.chat_id}: {e}")

    await log_broadcast("morning", text, success)
    logger.info(f"Morning broadcast done: {success}/{len(subscribers)}")


async def broadcast_evening(bot: Bot):
    """Send market brief + crypto to all active subscribers."""
    logger.info("Evening broadcast starting...")
    try:
        market_text = await get_market_brief()
        crypto_text = await get_crypto_brief()
        text = market_text + "\n\n" + crypto_text
    except Exception as e:
        logger.error(f"Evening data fetch failed: {e}")
        return

    subscribers = await get_active_subscribers()
    success = 0
    for sub in subscribers:
        try:
            await bot.send_message(
                chat_id=sub.chat_id,
                text=text,
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=with_partner("ko"),
            )
            success += 1
            await asyncio.sleep(0.05)
        except Exception as e:
            logger.warning(f"Failed to send evening to {sub.chat_id}: {e}")

    await log_broadcast("evening", text, success)
    logger.info(f"Evening broadcast done: {success}/{len(subscribers)}")


async def check_spikes(bot: Bot):
    """Check for large price moves and alert subscribers."""
    for symbol, name in SPIKE_TARGETS.items():
        data = await _fetch_ticker(symbol)
        if not data:
            continue

        prev = _prev_prices.get(symbol)
        current = data["price"]

        if prev is not None:
            change_pct = abs((current - prev) / prev * 100)
            # Alert if >3% move since last check
            if change_pct >= 3.0:
                direction = "🚀 급등" if current > prev else "💥 급락"
                sign = "+" if current > prev else "-"
                text = (
                    f"⚡ *급등/급락 알림*\n\n"
                    f"{direction} {name}\n"
                    f"변동: {sign}{change_pct:.2f}%\n"
                    f"현재가: ${current:,.2f}"
                )
                subscribers = await get_active_subscribers()
                for sub in subscribers:
                    try:
                        await bot.send_message(
                            chat_id=sub.chat_id,
                            text=text,
                            parse_mode=ParseMode.MARKDOWN,
                            reply_markup=with_partner("ko"),
                        )
                        await asyncio.sleep(0.05)
                    except Exception:
                        pass

        _prev_prices[symbol] = current


def setup_scheduler(bot: Bot) -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone=tz)

    scheduler.add_job(
        broadcast_morning,
        trigger=CronTrigger(hour=MORNING_HOUR, minute=0, timezone=tz),
        args=[bot],
        id="morning_broadcast",
        replace_existing=True,
    )

    scheduler.add_job(
        broadcast_evening,
        trigger=CronTrigger(hour=EVENING_HOUR, minute=0, timezone=tz),
        args=[bot],
        id="evening_broadcast",
        replace_existing=True,
    )

    # Check spikes every 30 minutes
    scheduler.add_job(
        check_spikes,
        trigger=CronTrigger(minute="*/30", timezone=tz),
        args=[bot],
        id="spike_check",
        replace_existing=True,
    )

    return scheduler
