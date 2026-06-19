from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone

import pytz
from telegram import Update
from telegram.ext import ContextTypes

from config import BET_CUTOFF_MINUTES, MULTIPLIERS
from database import (
    AsyncSessionLocal,
    Match,
    get_match,
    get_upcoming_matches,
    get_user,
    has_predicted,
    place_prediction,
)
from i18n import t
from utils.formatters import format_time, get_type_label, get_value_label
from utils.keyboards import (
    confirm_bet,
    match_list,
    pred_1x2,
    pred_btts,
    pred_first,
    pred_handicap,
    pred_ou,
    prediction_types,
    stake_options,
)

logger = logging.getLogger(__name__)

KST = pytz.timezone("Asia/Seoul")


def _get_match_multiplier(match: Match | None, pred_type: str, pred_value: str) -> float:
    """Return real bookmaker odds for this prediction, falling back to MULTIPLIERS."""
    if match:
        if pred_type == "1x2":
            if pred_value == "home" and match.odds_home:
                return float(match.odds_home)
            if pred_value == "draw" and match.odds_draw:
                return float(match.odds_draw)
            if pred_value == "away" and match.odds_away:
                return float(match.odds_away)
        elif pred_type == "btts":
            if pred_value == "yes" and match.odds_btts_yes:
                return float(match.odds_btts_yes)
            if pred_value == "no" and match.odds_btts_no:
                return float(match.odds_btts_no)
        elif pred_type == "ou":
            if pred_value == "over" and match.odds_over25:
                return float(match.odds_over25)
            if pred_value == "under" and match.odds_under25:
                return float(match.odds_under25)
    return MULTIPLIERS.get(pred_type, 1.9)


async def cmd_predict(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.effective_user or not update.message:
        return

    tg_user = update.effective_user
    async with AsyncSessionLocal() as session:
        user = await get_user(session, tg_user.id)
        lang = user.language if user else "en"
        matches = await get_upcoming_matches(session, limit=15)

    if not matches:
        await update.message.reply_text(t(lang, "no_matches"), parse_mode="Markdown")
        return

    text = f"*{t(lang, 'matches_title')}*"
    await update.message.reply_text(
        text,
        parse_mode="Markdown",
        reply_markup=match_list(matches, lang),
    )


async def show_match_list(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Show match list from callback."""
    query = update.callback_query
    if not query:
        return
    await query.answer()

    tg_user = update.effective_user
    async with AsyncSessionLocal() as session:
        user = await get_user(session, tg_user.id)
        lang = user.language if user else "en"
        matches = await get_upcoming_matches(session, limit=15)

    if not matches:
        await query.edit_message_text(t(lang, "no_matches"), parse_mode="Markdown")
        return

    text = f"*{t(lang, 'matches_title')}*"
    await query.edit_message_text(
        text,
        parse_mode="Markdown",
        reply_markup=match_list(matches, lang),
    )


# ---------------------------------------------------------------------------
# Callback: m:{match_id}
# ---------------------------------------------------------------------------

async def cb_match_detail(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query or not query.data:
        return
    await query.answer()

    match_id = int(query.data.split(":")[1])
    tg_user = update.effective_user

    async with AsyncSessionLocal() as session:
        user = await get_user(session, tg_user.id)
        lang = user.language if user else "en"
        match = await get_match(session, match_id)
        if not match:
            await query.edit_message_text("Match not found.")
            return

        already = await has_predicted(session, user.id, match_id) if user else False

    # Check cutoff
    now_utc = datetime.now(timezone.utc)
    match_utc = match.match_time if match.match_time.tzinfo else match.match_time.replace(tzinfo=timezone.utc)
    cutoff = match_utc - timedelta(minutes=BET_CUTOFF_MINUTES)

    if now_utc >= cutoff:
        await query.edit_message_text(
            t(lang, "match_closed", min=BET_CUTOFF_MINUTES),
            parse_mode="Markdown",
        )
        return

    if already:
        await query.edit_message_text(
            t(lang, "already_predicted"),
            parse_mode="Markdown",
        )
        return

    text = t(
        lang,
        "match_detail",
        home=match.home_team,
        away=match.away_team,
        league=match.league,
        time=format_time(match.match_time),
    ) + f"\n\n{t(lang, 'choose_pred_type')}"

    await query.edit_message_text(
        text,
        parse_mode="Markdown",
        reply_markup=prediction_types(match_id, lang),
    )


# ---------------------------------------------------------------------------
# Callback: pt:{match_id}:{type}
# ---------------------------------------------------------------------------

async def cb_pred_type(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query or not query.data:
        return
    await query.answer()

    parts = query.data.split(":")
    match_id = int(parts[1])
    pred_type = parts[2]
    tg_user = update.effective_user

    async with AsyncSessionLocal() as session:
        user = await get_user(session, tg_user.id)
        lang = user.language if user else "en"
        match = await get_match(session, match_id)
        if not match:
            return

    if pred_type == "1x2":
        text = t(lang, "choose_home_away", home=match.home_team, away=match.away_team)
        kb = pred_1x2(match_id, lang)
    elif pred_type == "btts":
        text = t(lang, "choose_btts")
        kb = pred_btts(match_id, lang)
    elif pred_type == "ou":
        text = t(lang, "choose_ou")
        kb = pred_ou(match_id, lang)
    elif pred_type == "first":
        text = t(lang, "choose_first")
        kb = pred_first(match_id, lang)
    elif pred_type == "handicap":
        text = t(lang, "choose_handicap")
        kb = pred_handicap(match_id, lang)
    elif pred_type == "score":
        # Store state and ask user to type the score
        context.user_data["awaiting_score"] = True
        context.user_data["score_match_id"] = match_id
        text = t(lang, "choose_score")
        from telegram import InlineKeyboardButton, InlineKeyboardMarkup
        kb = InlineKeyboardMarkup([[
            InlineKeyboardButton(t(lang, "btn_cancel"), callback_data=f"m:{match_id}")
        ]])
    else:
        return

    await query.edit_message_text(text, parse_mode="Markdown", reply_markup=kb)


# ---------------------------------------------------------------------------
# Callback: pv:{match_id}:{type}:{value}
# ---------------------------------------------------------------------------

async def cb_pred_value(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Show P stake options after user picks prediction value."""
    query = update.callback_query
    if not query or not query.data:
        return
    await query.answer()

    parts = query.data.split(":")
    match_id = int(parts[1])
    pred_type = parts[2]
    pred_value = parts[3]
    tg_user = update.effective_user

    async with AsyncSessionLocal() as session:
        user = await get_user(session, tg_user.id)
        lang = user.language if user else "en"
        p_balance = user.p_balance if user else 0
        match = await get_match(session, match_id)

    mult = _get_match_multiplier(match, pred_type, pred_value)
    example_payout = int(500 * mult)

    text = t(lang, "choose_stake", balance=p_balance, payout=example_payout, mult=mult)
    await query.edit_message_text(
        text,
        parse_mode="Markdown",
        reply_markup=stake_options(match_id, pred_type, pred_value, lang, p_balance, mult),
    )


# ---------------------------------------------------------------------------
# Callback: stake:{match_id}:{type}:{value}:{amount}
# ---------------------------------------------------------------------------

async def cb_stake(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query or not query.data:
        return
    await query.answer()

    parts = query.data.split(":")
    match_id = int(parts[1])
    pred_type = parts[2]
    pred_value = parts[3]
    stake = int(parts[4])
    tg_user = update.effective_user

    async with AsyncSessionLocal() as session:
        user = await get_user(session, tg_user.id)
        lang = user.language if user else "en"
        match = await get_match(session, match_id)
        if not match or not user:
            return
        balance = user.p_balance

    if balance < stake:
        await query.edit_message_text(
            t(lang, "insufficient_p", balance=balance, stake=stake),
            parse_mode="Markdown",
        )
        return

    mult = _get_match_multiplier(match, pred_type, pred_value)
    payout = int(stake * mult)
    type_label = get_type_label(lang, pred_type)
    value_label = get_value_label(lang, pred_type, pred_value)

    text = t(
        lang,
        "confirm_pred",
        home=match.home_team,
        away=match.away_team,
        type_label=type_label,
        value_label=value_label,
        stake=stake,
        payout=payout,
        mult=mult,
    )
    await query.edit_message_text(
        text,
        parse_mode="Markdown",
        reply_markup=confirm_bet(match_id, pred_type, pred_value, stake, lang),
    )


# ---------------------------------------------------------------------------
# Callback: confirm:{match_id}:{type}:{value}:{stake}
# ---------------------------------------------------------------------------

async def cb_confirm(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query or not query.data:
        return
    await query.answer()

    parts = query.data.split(":")
    match_id = int(parts[1])
    pred_type = parts[2]
    pred_value = parts[3]
    stake = int(parts[4])
    tg_user = update.effective_user

    async with AsyncSessionLocal() as session:
        user = await get_user(session, tg_user.id)
        lang = user.language if user else "en"

        if not user:
            await query.edit_message_text("Please use /start first.")
            return

        # Double-check cutoff
        match = await get_match(session, match_id)
        if not match:
            await query.edit_message_text("Match not found.")
            return

        now_utc = datetime.now(timezone.utc)
        match_utc = match.match_time if match.match_time.tzinfo else match.match_time.replace(tzinfo=timezone.utc)
        if now_utc >= match_utc - timedelta(minutes=BET_CUTOFF_MINUTES):
            await query.edit_message_text(t(lang, "match_closed", min=BET_CUTOFF_MINUTES), parse_mode="Markdown")
            return

        if await has_predicted(session, user.id, match_id):
            await query.edit_message_text(t(lang, "already_predicted"), parse_mode="Markdown")
            return

        if user.p_balance < stake:
            await query.edit_message_text(
                t(lang, "insufficient_p", balance=user.p_balance, stake=stake),
                parse_mode="Markdown",
            )
            return

        mult = _get_match_multiplier(match, pred_type, pred_value)
        payout = int(stake * mult)

        await place_prediction(session, user, match_id, pred_type, pred_value, stake, payout, "p")
        value_label = get_value_label(lang, pred_type, pred_value)

    await query.edit_message_text(
        t(
            lang,
            "pred_placed",
            home=match.home_team,
            away=match.away_team,
            value_label=value_label,
            stake=stake,
            payout=payout,
        ),
        parse_mode="Markdown",
    )


# ---------------------------------------------------------------------------
# Callback: analysis:{match_id}
# ---------------------------------------------------------------------------

async def cb_analysis(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query or not query.data:
        return
    await query.answer(text="Generating AI analysis...", show_alert=False)

    match_id = int(query.data.split(":")[1])
    tg_user = update.effective_user

    async with AsyncSessionLocal() as session:
        user = await get_user(session, tg_user.id)
        lang = user.language if user else "en"
        match = await get_match(session, match_id)
        if not match:
            return

    await query.edit_message_text(t(lang, "analysis_generating"), parse_mode="Markdown")

    from services.ai_service import generate_match_analysis
    analysis = await generate_match_analysis(match.home_team, match.away_team, match.league, lang)

    if not analysis:
        await query.edit_message_text(
            t(lang, "analysis_unavailable"),
            parse_mode="Markdown",
        )
        return

    from telegram import InlineKeyboardButton, InlineKeyboardMarkup
    header = (
        f"🤖 *{t(lang, 'analysis_title')}*\n"
        f"⚽ {match.home_team} vs {match.away_team}\n"
        f"🏆 {match.league}\n\n"
    )
    text = header + analysis
    kb = InlineKeyboardMarkup([[
        InlineKeyboardButton(t(lang, "btn_back"), callback_data=f"m:{match_id}")
    ]])
    # Telegram message limit is 4096 chars
    if len(text) > 4000:
        text = text[:4000] + "..."
    await query.edit_message_text(text, parse_mode="Markdown", reply_markup=kb)


# ---------------------------------------------------------------------------
# MessageHandler: handle typed score input
# ---------------------------------------------------------------------------

async def handle_score_input(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle text message when user is entering an exact score."""
    if not context.user_data.get("awaiting_score"):
        return

    if not update.effective_user or not update.message:
        return

    text = (update.message.text or "").strip()
    tg_user = update.effective_user

    if not re.match(r"^\d{1,2}-\d{1,2}$", text):
        async with AsyncSessionLocal() as session:
            user = await get_user(session, tg_user.id)
            lang = user.language if user else "en"
        await update.message.reply_text(t(lang, "invalid_score"), parse_mode="Markdown")
        return

    match_id = context.user_data.get("score_match_id")
    if not match_id:
        return

    # Clear state
    context.user_data.pop("awaiting_score", None)
    context.user_data.pop("score_match_id", None)

    pred_value = text  # e.g. "2-1"

    async with AsyncSessionLocal() as session:
        user = await get_user(session, tg_user.id)
        lang = user.language if user else "en"
        p_balance = user.p_balance if user else 0
        match = await get_match(session, match_id)
        if not match:
            return

    from config import MULTIPLIERS
    mult = MULTIPLIERS.get("score", 8.0)
    example_payout = int(500 * mult)

    await update.message.reply_text(
        t(lang, "choose_stake", balance=p_balance, payout=example_payout, mult=mult),
        parse_mode="Markdown",
        reply_markup=stake_options(match_id, "score", pred_value, lang, p_balance, mult),
    )
