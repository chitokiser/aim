"""AI Money Hunter Bot — entry point."""

import logging
from telegram import BotCommand
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
)

from telegram.request import HTTPXRequest

from config import BOT_TOKEN
from database import init_db
from handlers.commands import (
    cmd_start,
    cmd_today,
    cmd_market,
    cmd_crypto,
    cmd_gold,
    cmd_stock,
    cmd_trend,
    callback_refresh,
)
from handlers.subscribe import cmd_subscribe, cmd_unsubscribe
from handlers.admin import cmd_admin, cmd_stats, cmd_broadcast
from services.scheduler_service import setup_scheduler

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

BOT_COMMANDS = [
    BotCommand("start", "봇 시작"),
    BotCommand("today", "오늘의 돈벌이 아이디어"),
    BotCommand("market", "글로벌 시장 현황"),
    BotCommand("crypto", "암호화폐 시세"),
    BotCommand("gold", "금값 조회"),
    BotCommand("stock", "특정 종목 조회"),
    BotCommand("trend", "AI 트렌드 분석"),
    BotCommand("subscribe", "자동 알림 구독"),
    BotCommand("unsubscribe", "알림 해제"),
]


async def post_init(app: Application):
    await init_db()
    logger.info("Database initialized.")
    await app.bot.set_my_commands(BOT_COMMANDS)
    logger.info("Bot commands registered.")


def main():
    request = HTTPXRequest(connect_timeout=30, read_timeout=30, write_timeout=30)
    app = (
        Application.builder()
        .token(BOT_TOKEN)
        .request(request)
        .post_init(post_init)
        .build()
    )

    # Command handlers
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("today", cmd_today))
    app.add_handler(CommandHandler("market", cmd_market))
    app.add_handler(CommandHandler("crypto", cmd_crypto))
    app.add_handler(CommandHandler("gold", cmd_gold))
    app.add_handler(CommandHandler("stock", cmd_stock))
    app.add_handler(CommandHandler("trend", cmd_trend))
    app.add_handler(CommandHandler("subscribe", cmd_subscribe))
    app.add_handler(CommandHandler("unsubscribe", cmd_unsubscribe))

    # Admin handlers
    app.add_handler(CommandHandler("admin", cmd_admin))
    app.add_handler(CommandHandler("stats", cmd_stats))
    app.add_handler(CommandHandler("broadcast", cmd_broadcast))

    # Inline keyboard callbacks
    app.add_handler(CallbackQueryHandler(callback_refresh))

    # Scheduler
    scheduler = setup_scheduler(app.bot)
    scheduler.start()
    logger.info("Scheduler started.")

    logger.info("AI Money Hunter Bot is running...")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
