from __future__ import annotations

import logging

from telegram import Update
from telegram.ext import ContextTypes

from database import AsyncSessionLocal, get_leaderboard, get_user, get_user_rank
from i18n import t
from utils.keyboards import main_menu

logger = logging.getLogger(__name__)

MEDALS = ["🥇", "🥈", "🥉"]


async def cmd_ranking(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.effective_user or not update.message:
        return

    tg_user = update.effective_user
    async with AsyncSessionLocal() as session:
        user = await get_user(session, tg_user.id)
        lang = user.language if user else "en"
        leaders = await get_leaderboard(session, limit=20)
        my_rank = await get_user_rank(session, user.id) if user else 0

    text = _build_ranking_text(leaders, lang, my_rank)
    await update.message.reply_text(text, parse_mode="Markdown", reply_markup=main_menu(lang))


async def show_ranking(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Called from callback (inline button)."""
    query = update.callback_query
    if not query:
        return
    await query.answer()

    tg_user = update.effective_user
    async with AsyncSessionLocal() as session:
        user = await get_user(session, tg_user.id)
        lang = user.language if user else "en"
        leaders = await get_leaderboard(session, limit=20)
        my_rank = await get_user_rank(session, user.id) if user else 0

    text = _build_ranking_text(leaders, lang, my_rank)
    await query.edit_message_text(text, parse_mode="Markdown", reply_markup=main_menu(lang))


def _build_ranking_text(leaders: list, lang: str, my_rank: int) -> str:
    title = t(lang, "ranking_title")
    if not leaders:
        return f"*{title}*\n\n{t(lang, 'ranking_empty')}"

    lines = [f"*{title}*\n"]
    for i, u in enumerate(leaders):
        rank = i + 1
        medal = MEDALS[i] if i < 3 else f"{rank}."
        name = u.first_name or u.username or f"User{u.telegram_id}"
        rate = 0
        if u.total_predicted > 0:
            rate = round(u.correct_predictions / u.total_predicted * 100, 1)
        line = t(
            lang,
            "ranking_row",
            rank=medal,
            name=name,
            correct=u.correct_predictions,
            rate=rate,
            earned=u.total_ap_won,
        )
        lines.append(line)

    if my_rank:
        lines.append(f"\n{t(lang, 'ranking_footer', my_rank=my_rank)}")

    return "\n".join(lines)
