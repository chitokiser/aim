from __future__ import annotations

import logging

from telegram import Update
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    MessageHandler,
    filters,
)

from config import BOT_TOKEN
from database import init_db
from handlers.admin import (
    cmd_admin,
    cmd_addmatch,
    cmd_broadcast,
    cmd_cancelbet,
    cmd_settle,
    handle_addmatch_input,
)
from handlers.commands import (
    cb_main_menu,
    cmd_chatid,
    cmd_daily,
    cmd_help,
    cmd_lang,
    cmd_my,
    cmd_start,
)
from handlers.predict import (
    cb_analysis,
    cb_confirm,
    cb_currency,
    cb_match_detail,
    cb_pred_type,
    cb_pred_value,
    cb_stake,
    cmd_predict,
    handle_score_input,
)
from handlers.ranking import cmd_ranking
from services.scheduler import (
    auto_settle_finished,
    broadcast_live_update,
    broadcast_pre_match_alert,
    sync_api_matches,
)

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


async def post_init(app: Application) -> None:
    await init_db()
    logger.info("Database initialized")

    # Seed matches from football-data.org on startup
    await sync_api_matches()


def main() -> None:
    if not BOT_TOKEN:
        raise ValueError("BOT_TOKEN is not set in .env")

    app = (
        Application.builder()
        .token(BOT_TOKEN)
        .post_init(post_init)
        .build()
    )

    # ----- Command handlers -----
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("daily", cmd_daily))
    app.add_handler(CommandHandler("predict", cmd_predict))
    app.add_handler(CommandHandler("matches", cmd_predict))
    app.add_handler(CommandHandler("my", cmd_my))
    app.add_handler(CommandHandler("profile", cmd_my))
    app.add_handler(CommandHandler("ranking", cmd_ranking))
    app.add_handler(CommandHandler("help", cmd_help))
    app.add_handler(CommandHandler("lang", cmd_lang))
    app.add_handler(CommandHandler("chatid", cmd_chatid))

    # Admin commands
    app.add_handler(CommandHandler("admin", cmd_admin))
    app.add_handler(CommandHandler("addmatch", cmd_addmatch))
    app.add_handler(CommandHandler("settle", cmd_settle))
    app.add_handler(CommandHandler("cancelbet", cmd_cancelbet))
    app.add_handler(CommandHandler("broadcast", cmd_broadcast))

    # ----- Callback query handlers (ordered most-specific first) -----
    app.add_handler(CallbackQueryHandler(cb_main_menu, pattern=r"^cmd:"))
    app.add_handler(CallbackQueryHandler(cb_match_detail, pattern=r"^m:\d+$"))
    app.add_handler(CallbackQueryHandler(cb_pred_type, pattern=r"^pt:"))
    app.add_handler(CallbackQueryHandler(cb_pred_value, pattern=r"^pv:"))
    app.add_handler(CallbackQueryHandler(cb_currency, pattern=r"^curr:"))
    app.add_handler(CallbackQueryHandler(cb_stake, pattern=r"^stake:"))
    app.add_handler(CallbackQueryHandler(cb_confirm, pattern=r"^confirm:"))
    app.add_handler(CallbackQueryHandler(cb_analysis, pattern=r"^analysis:"))

    # ----- Message handlers (text input for admin addmatch & score input) -----
    # Priority: admin input > score input (checked via user_data state)
    app.add_handler(
        MessageHandler(filters.TEXT & ~filters.COMMAND, _dispatch_text_input)
    )

    # ----- Job queue: periodic tasks -----
    job_queue = app.job_queue
    if job_queue:
        # Sync matches from football-data.org every 6 hours
        job_queue.run_repeating(
            _sync_matches_job, interval=21600, first=300, name="sync_matches"
        )
        # Auto-settle finished matches every 30 minutes
        job_queue.run_repeating(
            _auto_settle_job, interval=1800, first=120, name="auto_settle"
        )
        # Pre-match alert: check every 5 minutes for matches ~1 hour away
        job_queue.run_repeating(
            _pre_match_alert_job, interval=300, first=60, name="pre_match_alert"
        )
        # Live update: broadcast score briefing to group every 15 minutes
        job_queue.run_repeating(
            _live_update_job, interval=900, first=180, name="live_update"
        )

    logger.info("⚽ AI119 Football Predictor starting...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


async def _dispatch_text_input(update: Update, context) -> None:
    """Route free-text messages to the correct handler based on user state."""
    # Admin addmatch has higher priority
    if context.user_data.get("awaiting_addmatch"):
        await handle_addmatch_input(update, context)
        return
    if context.user_data.get("awaiting_score"):
        await handle_score_input(update, context)
        return


async def _sync_matches_job(context) -> None:
    await sync_api_matches()


async def _auto_settle_job(context) -> None:
    await auto_settle_finished(app=context.application)


async def _pre_match_alert_job(context) -> None:
    await broadcast_pre_match_alert(context.application)


async def _live_update_job(context) -> None:
    await broadcast_live_update(context.application)


if __name__ == "__main__":
    main()
