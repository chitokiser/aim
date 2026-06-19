"""AI Treasure Hunt Bot — entry point."""

import logging
from telegram import BotCommand
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
from handlers.commands import cmd_start, cmd_treasures, cmd_gp
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
    BotCommand("start", "봇 시작 / 메인 메뉴"),
    BotCommand("treasures", "보물 목록 보기"),
    BotCommand("gp", "내 P 잔액 확인"),
    BotCommand("newtreasure", "[관리자] 새 보물 등록"),
    BotCommand("admin", "[관리자] 관리자 패널"),
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
    app.add_handler(CommandHandler("admin", cmd_admin))

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

    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
