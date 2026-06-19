"""AI Treasure Hunt Bot — entry point."""

import logging
import sys
from telegram import BotCommand, Update
from telegram.error import Conflict
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    MessageHandler,
    ConversationHandler,
    filters,
)
from telegram.request import HTTPXRequest

from config import BOT_TOKEN
from database import init_db
from handlers.commands import cmd_start, cmd_treasures, cmd_gp, cmd_lang, cb_set_lang
from handlers.admin import (
    cmd_newtreasure,
    cmd_admin,
    handle_coords,
    handle_prize,
    handle_desc,
    handle_cancel,
    ASK_COORDS,
    ASK_PRIZE,
    ASK_DESC,
)
from handlers.game import (
    cb_treasure_list,
    cb_treasure_info,
    cb_treasure_start,
    cb_show_question,
    cb_answer,
    cb_need_hint,
    cb_buy_hint,
    cb_menu,
    cb_noop,
)

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

BOT_COMMANDS = [
    BotCommand("start", "Start / Main Menu"),
    BotCommand("treasures", "Treasure list"),
    BotCommand("gp", "My P balance"),
    BotCommand("lang", "Change language / 언어 변경 / Đổi ngôn ngữ"),
    BotCommand("newtreasure", "[Admin] Register new treasure"),
    BotCommand("admin", "[Admin] Admin panel"),
]


async def post_init(app: Application) -> None:
    await init_db()
    me = await app.bot.get_me()
    app.bot_data["username"] = me.username
    await app.bot.set_my_commands(BOT_COMMANDS)
    logger.info("Treasure Hunt Bot started. @%s", me.username)


def main() -> None:
    if not BOT_TOKEN:
        raise RuntimeError("BOT_TOKEN is not set in environment")

    request = HTTPXRequest(connect_timeout=30, read_timeout=60, write_timeout=60)
    app = (
        Application.builder()
        .token(BOT_TOKEN)
        .request(request)
        .post_init(post_init)
        .build()
    )

    # ── Admin: create new treasure (ConversationHandler) ──────────────────────
    conv = ConversationHandler(
        entry_points=[CommandHandler("newtreasure", cmd_newtreasure)],
        states={
            ASK_COORDS: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_coords)],
            ASK_PRIZE:  [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_prize)],
            ASK_DESC:   [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_desc)],
        },
        fallbacks=[CommandHandler("cancel", handle_cancel)],
        per_user=True,
        allow_reentry=True,
    )
    app.add_handler(conv)

    # ── Public commands ────────────────────────────────────────────────────────
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("treasures", cmd_treasures))
    app.add_handler(CommandHandler("gp", cmd_gp))
    app.add_handler(CommandHandler("lang", cmd_lang))
    app.add_handler(CommandHandler("admin", cmd_admin))

    # ── Language selection callback ────────────────────────────────────────────
    app.add_handler(CallbackQueryHandler(cb_set_lang, pattern=r"^lang:(en|ko|vi)$"))

    # ── Game callbacks ─────────────────────────────────────────────────────────
    app.add_handler(CallbackQueryHandler(cb_menu,           pattern=r"^menu$"))
    app.add_handler(CallbackQueryHandler(cb_treasure_list,  pattern=r"^tl$"))
    app.add_handler(CallbackQueryHandler(cb_treasure_info,  pattern=r"^ti:\d+$"))
    app.add_handler(CallbackQueryHandler(cb_treasure_start, pattern=r"^ts:\d+$"))
    app.add_handler(CallbackQueryHandler(cb_show_question,  pattern=r"^nxt:\d+:\d+$"))
    app.add_handler(CallbackQueryHandler(cb_answer,         pattern=r"^ans:\d+:\d+:\d+$"))
    app.add_handler(CallbackQueryHandler(cb_need_hint,      pattern=r"^nh:\d+:\d+:\d+$"))
    app.add_handler(CallbackQueryHandler(cb_buy_hint,       pattern=r"^bh:\d+:\d+:\d+$"))
    app.add_handler(CallbackQueryHandler(cb_noop,           pattern=r"^noop$"))

    app.add_error_handler(_error_handler)

    app.run_polling(drop_pending_updates=True)


async def _error_handler(update: object, context) -> None:
    if isinstance(context.error, Conflict):
        logger.critical("Conflict: another instance is already polling. Exiting.")
        sys.exit(1)
    logger.error("Unhandled exception: %s", context.error, exc_info=context.error)


if __name__ == "__main__":
    main()
