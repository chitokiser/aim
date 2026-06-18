from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application

from config import DAILY_AP, GROUP_CHAT_ID, SITE_URL
from database import AsyncSessionLocal, Match, count_predictions_for_match, get_all_user_telegram_ids

logger = logging.getLogger(__name__)

# Tracks match IDs that already received a 1-hour pre-match alert (resets on restart)
_pre_alert_sent: set[int] = set()


async def sync_api_matches() -> None:
    """Fetch upcoming matches from football-data.org and upsert into the DB."""
    from services.football_api import fetch_upcoming_matches
    from database import add_match
    from sqlalchemy import select

    matches = await fetch_upcoming_matches(days_ahead=3)
    if not matches:
        return

    async with AsyncSessionLocal() as session:
        for m in matches:
            ext_id = m["external_id"]
            if ext_id:
                existing = await session.execute(
                    select(Match).where(Match.external_id == ext_id)
                )
                if existing.scalar_one_or_none():
                    continue

            match_time = m["match_time"]
            if match_time.tzinfo is not None:
                match_time = match_time.astimezone(timezone.utc).replace(tzinfo=None)

            await add_match(
                session,
                home_team=m["home_team"],
                away_team=m["away_team"],
                league=m["league"],
                match_time=match_time,
                external_id=ext_id,
            )
    logger.info("Synced %d matches from football-data.org", len(matches))


async def auto_settle_finished(app: Application | None = None) -> None:
    """Check live matches from football-data.org and auto-settle finished ones."""
    from services.football_api import fetch_match_result
    from database import settle_match
    from sqlalchemy import select

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Match).where(
                Match.status.in_(["scheduled", "live"]),
                Match.external_id.is_not(None),
                Match.match_time <= datetime.utcnow(),
            )
        )
        candidates = list(result.scalars().all())

    for match in candidates:
        data = await fetch_match_result(match.external_id)
        if not data:
            continue
        async with AsyncSessionLocal() as session:
            m = await session.get(Match, match.id)
            if not m or m.status == "finished":
                continue
            winners, payout = await settle_match(session, m, data["home_score"], data["away_score"])
            logger.info(
                "Auto-settled match %d (%s vs %s): %d winners, %d AP paid",
                match.id, match.home_team, match.away_team, winners, payout,
            )
        if app and GROUP_CHAT_ID:
            await broadcast_settlement_result(
                app, match, data["home_score"], data["away_score"], winners, payout
            )


async def daily_reminder(app: Application) -> None:
    """Send a reminder to all users to claim their daily AP."""
    async with AsyncSessionLocal() as session:
        telegram_ids = await get_all_user_telegram_ids(session)

    for tid in telegram_ids:
        try:
            await app.bot.send_message(
                chat_id=tid,
                text=(
                    "⚽ *AI119 Football Predictor*\n\n"
                    "📅 Your daily *10,000 AP* is ready!\n"
                    "Type /daily to claim it."
                ),
                parse_mode="Markdown",
            )
        except Exception:
            pass

    logger.info("Daily reminder sent to %d users", len(telegram_ids))


async def broadcast_pre_match_alert(app: Application) -> None:
    """Send 1-hour pre-match alert to GROUP_CHAT_ID for upcoming matches."""
    if not GROUP_CHAT_ID:
        return

    from sqlalchemy import select

    now_utc = datetime.now(timezone.utc)
    # Window: matches kicking off 55–65 minutes from now
    window_start = (now_utc + timedelta(minutes=55)).replace(tzinfo=None)
    window_end = (now_utc + timedelta(minutes=65)).replace(tzinfo=None)

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Match).where(
                Match.status == "scheduled",
                Match.match_time >= window_start,
                Match.match_time <= window_end,
            )
        )
        upcoming = list(result.scalars().all())

    for match in upcoming:
        if match.id in _pre_alert_sent:
            continue

        bot_username = app.bot.username or ""
        predict_url = (
            f"https://t.me/{bot_username}?start=predict"
            if bot_username
            else "https://t.me/ai119"
        )

        text = (
            f"⚽ *경기 예고! / Match Alert!*\n\n"
            f"🏆 {match.league}\n"
            f"🆚 *{match.home_team}* vs *{match.away_team}*\n"
            f"⏰ 약 1시간 후 킥오프! / Kick-off in ~1 hour!\n\n"
            f"🎯 무료 AP로 승무패를 예측하고 포인트를 획득하세요!\n"
            f"🎯 Predict 1X2 with free daily AP and win points!\n"
            f"🎯 Dự đoán 1X2 bằng AP miễn phí để nhận thưởng!\n\n"
            f"💰 매일 *10,000 AP* 무료 지급 / *10,000 AP* free every day!"
        )

        keyboard = InlineKeyboardMarkup([
            [
                InlineKeyboardButton("⚽ 예측하기 / Predict Now", url=predict_url),
                InlineKeyboardButton("💬 AIM Community", url="https://t.me/ai119"),
            ],
            [InlineKeyboardButton("💎 스폰서 / Sponsor — AI119", url=SITE_URL)],
        ])

        try:
            await app.bot.send_message(
                chat_id=GROUP_CHAT_ID,
                text=text,
                parse_mode="Markdown",
                reply_markup=keyboard,
            )
            _pre_alert_sent.add(match.id)
            logger.info(
                "Pre-match alert sent for match %d (%s vs %s)",
                match.id, match.home_team, match.away_team,
            )
        except Exception as exc:
            logger.error("Failed to send pre-match alert: %s", exc)


async def broadcast_live_update(app: Application) -> None:
    """Send live score update to GROUP_CHAT_ID every 10 minutes for ongoing matches."""
    if not GROUP_CHAT_ID:
        return

    from services.football_api import fetch_live_score
    from sqlalchemy import select

    now_utc = datetime.now(timezone.utc)
    cutoff = (now_utc - timedelta(hours=3)).replace(tzinfo=None)
    now_naive = now_utc.replace(tzinfo=None)

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Match).where(
                Match.status.in_(["scheduled", "live"]),
                Match.match_time <= now_naive,
                Match.match_time >= cutoff,
            )
        )
        live_matches = list(result.scalars().all())

    if not live_matches:
        return

    bot_username = app.bot.username or ""
    predict_url = (
        f"https://t.me/{bot_username}?start=predict"
        if bot_username
        else "https://t.me/ai119"
    )

    for match in live_matches:
        async with AsyncSessionLocal() as session:
            pred_count = await count_predictions_for_match(session, match.id)

        score_line = f"*{match.home_team}* vs *{match.away_team}* — 경기 진행 중 / In Progress"

        if match.external_id:
            live_data = await fetch_live_score(match.external_id)
            if live_data:
                hs = live_data["home_score"]
                aws = live_data["away_score"]
                status_map = {
                    "IN_PLAY": "⚡ IN PLAY",
                    "PAUSED": "⏸ HALF TIME",
                    "FINISHED": "✅ FT",
                }
                status_label = status_map.get(live_data["status"], live_data["status"])
                score_line = (
                    f"*{match.home_team}* {hs} - {aws} *{match.away_team}*\n"
                    f"🔴 {status_label}"
                )

        text = (
            f"📡 *경기 중계 / Live Update*\n\n"
            f"🏆 {match.league}\n"
            f"⚽ {score_line}\n\n"
            f"👥 예측 참여자: *{pred_count}명* / Predictors: *{pred_count}*\n\n"
            f"🎯 아직 예측하지 않았다면 지금 참여하세요!\n"
            f"🎯 Haven't predicted yet? Join now!\n"
            f"🎯 Chưa dự đoán? Tham gia ngay!"
        )

        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("⚽ 예측 참여 / Join Prediction", url=predict_url)],
            [InlineKeyboardButton("💎 스폰서 / Sponsor — AI119", url=SITE_URL)],
        ])

        try:
            await app.bot.send_message(
                chat_id=GROUP_CHAT_ID,
                text=text,
                parse_mode="Markdown",
                reply_markup=keyboard,
            )
            logger.info(
                "Live update sent for match %d (%s vs %s)",
                match.id, match.home_team, match.away_team,
            )
        except Exception as exc:
            logger.error("Failed to send live update: %s", exc)


async def broadcast_settlement_result(
    app: Application,
    match: Match,
    home_score: int,
    away_score: int,
    winners: int,
    payout: int,
) -> None:
    """Send settlement result to GROUP_CHAT_ID after a match is settled."""
    if not GROUP_CHAT_ID:
        return

    if home_score > away_score:
        result_text = f"🏆 {match.home_team} 승리! / {match.home_team} Win!"
    elif home_score == away_score:
        result_text = "🤝 무승부! / Draw!"
    else:
        result_text = f"🏆 {match.away_team} 승리! / {match.away_team} Win!"

    text = (
        f"✅ *경기 종료! / Full Time!*\n\n"
        f"🏆 {match.league}\n"
        f"⚽ *{match.home_team}* {home_score} - {away_score} *{match.away_team}*\n\n"
        f"{result_text}\n\n"
        f"📊 *정산 결과 / Settlement Results*\n"
        f"👥 승리자: *{winners}명* / Winners: *{winners}*\n"
        f"💰 총 지급 AP: *{payout:,} AP*\n\n"
        f"🎯 다음 경기를 예측하고 더 많은 AP를 획득하세요!\n"
        f"🎯 Predict the next match and win more AP!\n"
        f"🎯 Dự đoán trận tiếp theo để nhận thêm AP!"
    )

    bot_username = app.bot.username or ""
    predict_url = (
        f"https://t.me/{bot_username}?start=predict"
        if bot_username
        else "https://t.me/ai119"
    )

    keyboard = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("⚽ 다음 경기 예측 / Next Match", url=predict_url),
            InlineKeyboardButton("💬 AIM Community", url="https://t.me/ai119"),
        ],
        [InlineKeyboardButton("💎 스폰서 / Sponsor — AI119", url=SITE_URL)],
    ])

    try:
        await app.bot.send_message(
            chat_id=GROUP_CHAT_ID,
            text=text,
            parse_mode="Markdown",
            reply_markup=keyboard,
        )
        logger.info(
            "Settlement broadcast sent for match %d (%s %d-%d %s): %d winners, %d AP",
            match.id, match.home_team, home_score, away_score, match.away_team, winners, payout,
        )
    except Exception as exc:
        logger.error("Failed to send settlement broadcast: %s", exc)
