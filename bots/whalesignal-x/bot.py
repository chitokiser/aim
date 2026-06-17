"""WhaleSignal X — AI Opportunity Intelligence Platform.

Follow The Money: AI가 전 세계 투자금, 그랜트, 에어드랍,
해커톤, 스마트머니, 채용, 정부지원금을 실시간 추적합니다.
"""
import asyncio
import logging
import sys
from telegram.ext import Application
from config import BOT_TOKEN
from database import db
from handlers.commands import (
    start_handler, help_handler, top_handler, calendar_handler,
    subscribe_handler, generic_category_handler, callback_query_handler,
)
from handlers.admin import (
    admin_handler, stats_handler, users_handler, broadcast_handler,
    trending_handler, collect_handler, set_subscription_handler,
)
from services.scheduler_service import init_scheduler
from telegram.ext import CommandHandler, CallbackQueryHandler

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)

CATEGORY_COMMANDS = [
    "funding", "grants", "hackathon", "airdrop", "testnet",
    "listings", "smartmoney", "github", "social", "dao", "jobs",
    "gov", "gamefi", "nft", "depin", "rwa", "etf", "hidden",
]


async def post_init(application: Application):
    await db.connect()
    logger.info("Database connected")

    for cat in CATEGORY_COMMANDS:
        handler = await generic_category_handler(cat)
        application.add_handler(CommandHandler(cat, handler))
        logger.debug(f"Registered handler: /{cat}")

    for plan in ("pro", "vip", "free"):
        sub_handler = await set_subscription_handler(plan)
        application.add_handler(CommandHandler(f"set{plan}", sub_handler))

    init_scheduler(application.bot)
    logger.info("Scheduler initialized")

    from services.scheduler_service import collect_all
    asyncio.create_task(collect_all())
    logger.info("Initial data collection started")


async def post_shutdown(application: Application):
    await db.disconnect()
    from services.scheduler_service import scheduler
    if scheduler.running:
        scheduler.shutdown(wait=False)
    logger.info("Shutdown complete")


def main():
    if not BOT_TOKEN:
        logger.error("WHALASIGNAL_BOT_TOKEN is not set. Check your .env file.")
        sys.exit(1)

    app = (
        Application.builder()
        .token(BOT_TOKEN)
        .post_init(post_init)
        .post_shutdown(post_shutdown)
        .build()
    )

    app.add_handler(CommandHandler("start", start_handler))
    app.add_handler(CommandHandler("help", help_handler))
    app.add_handler(CommandHandler("top", top_handler))
    app.add_handler(CommandHandler("calendar", calendar_handler))
    app.add_handler(CommandHandler("subscribe", subscribe_handler))
    app.add_handler(CommandHandler("admin", admin_handler))
    app.add_handler(CommandHandler("stats", stats_handler))
    app.add_handler(CommandHandler("users", users_handler))
    app.add_handler(CommandHandler("broadcast", broadcast_handler))
    app.add_handler(CommandHandler("trending", trending_handler))
    app.add_handler(CommandHandler("collect", collect_handler))
    app.add_handler(CallbackQueryHandler(callback_query_handler))

    logger.info("WhaleSignal X bot starting...")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
