from __future__ import annotations

import logging
from datetime import datetime

import pytz
from telegram import Update
from telegram.ext import ContextTypes

from config import ADMIN_IDS
from database import (
    AsyncSessionLocal,
    add_match,
    cancel_match_predictions,
    get_all_user_telegram_ids,
    get_match,
    settle_match,
)
from i18n import t

logger = logging.getLogger(__name__)

KST = pytz.timezone("Asia/Seoul")


def is_admin(user_id: int) -> bool:
    return user_id in ADMIN_IDS


async def cmd_admin(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.effective_user or not update.message:
        return
    if not is_admin(update.effective_user.id):
        return

    await update.message.reply_text(t("en", "admin_menu"), parse_mode="Markdown")


async def cmd_addmatch(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Admin command to start adding a match.
    Admin then sends: Home Team | Away Team | League | YYYY-MM-DD HH:MM
    """
    if not update.effective_user or not update.message:
        return
    if not is_admin(update.effective_user.id):
        return

    context.user_data["awaiting_addmatch"] = True
    await update.message.reply_text(t("en", "addmatch_prompt"), parse_mode="Markdown")


async def cmd_settle(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    /settle <match_id> <home_score>-<away_score>
    Example: /settle 5 2-1
    """
    if not update.effective_user or not update.message:
        return
    if not is_admin(update.effective_user.id):
        return

    args = context.args or []
    if len(args) < 2:
        await update.message.reply_text(t("en", "settle_err"), parse_mode="Markdown")
        return

    try:
        match_id = int(args[0])
        score_parts = args[1].split("-")
        home_score = int(score_parts[0])
        away_score = int(score_parts[1])
    except (ValueError, IndexError):
        await update.message.reply_text(t("en", "settle_err"), parse_mode="Markdown")
        return

    async with AsyncSessionLocal() as session:
        match = await get_match(session, match_id)
        if not match:
            await update.message.reply_text(
                t("en", "settle_not_found", id=match_id),
                parse_mode="Markdown",
            )
            return

        home_name = match.home_team
        away_name = match.away_team
        winners, total_payout = await settle_match(session, match, home_score, away_score)

    await update.message.reply_text(
        t(
            "en",
            "settle_ok",
            home=home_name,
            hs=home_score,
            **{"as_": away_score},
            away=away_name,
            winners=winners,
            payout=total_payout,
        ),
        parse_mode="Markdown",
    )


async def cmd_cancelbet(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    /cancelbet <match_id> — refund all bets on a match
    """
    if not update.effective_user or not update.message:
        return
    if not is_admin(update.effective_user.id):
        return

    args = context.args or []
    if not args:
        await update.message.reply_text("Usage: /cancelbet <match_id>")
        return

    try:
        match_id = int(args[0])
    except ValueError:
        await update.message.reply_text("Invalid match ID.")
        return

    async with AsyncSessionLocal() as session:
        match = await get_match(session, match_id)
        if not match:
            await update.message.reply_text(f"Match {match_id} not found.")
            return
        count = await cancel_match_predictions(session, match)

    await update.message.reply_text(
        f"✅ Cancelled {count} predictions for match {match_id} and refunded P."
    )


async def cmd_broadcast(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    /broadcast <message> — Send a message to all registered users.
    """
    if not update.effective_user or not update.message:
        return
    if not is_admin(update.effective_user.id):
        return

    if not context.args:
        await update.message.reply_text(t("en", "broadcast_usage"), parse_mode="Markdown")
        return

    broadcast_text = " ".join(context.args)

    async with AsyncSessionLocal() as session:
        tg_ids = await get_all_user_telegram_ids(session)

    sent = 0
    for tid in tg_ids:
        try:
            await context.bot.send_message(
                chat_id=tid,
                text=f"📢 {broadcast_text}",
                parse_mode="Markdown",
            )
            sent += 1
        except Exception:
            pass

    await update.message.reply_text(
        t("en", "broadcast_sent", count=sent),
        parse_mode="Markdown",
    )


# ---------------------------------------------------------------------------
# MessageHandler: handle addmatch text input
# ---------------------------------------------------------------------------

async def handle_addmatch_input(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle text when admin is entering a new match."""
    if not context.user_data.get("awaiting_addmatch"):
        return
    if not update.effective_user or not update.message:
        return
    if not is_admin(update.effective_user.id):
        return

    text = (update.message.text or "").strip()
    parts = [p.strip() for p in text.split("|")]

    if len(parts) != 4:
        await update.message.reply_text(t("en", "addmatch_err"), parse_mode="Markdown")
        return

    home_team, away_team, league, time_str = parts
    try:
        # Parse KST time, convert to UTC
        kst_dt = KST.localize(datetime.strptime(time_str, "%Y-%m-%d %H:%M"))
        utc_dt = kst_dt.astimezone(pytz.utc).replace(tzinfo=None)
    except ValueError:
        await update.message.reply_text(t("en", "addmatch_err"), parse_mode="Markdown")
        return

    context.user_data.pop("awaiting_addmatch", None)

    async with AsyncSessionLocal() as session:
        match = await add_match(session, home_team, away_team, league, utc_dt)

    await update.message.reply_text(
        t(
            "en",
            "addmatch_ok",
            id=match.id,
            home=home_team,
            away=away_team,
            time=time_str,
        ),
        parse_mode="Markdown",
    )
