from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application

from config import GROUP_CHAT_ID, SITE_URL
from database import AsyncSessionLocal, Match, count_predictions_for_match, get_all_user_telegram_ids

logger = logging.getLogger(__name__)

# Tracks (match_id, hours_before) pairs that already received a pre-match alert.
# Hours 1–12 are broadcast once per hour starting 12h before kick-off.
_pre_alert_sent: set[tuple[int, int]] = set()


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


async def sync_odds() -> None:
    """Fetch real bookmaker odds and update all scheduled matches in DB."""
    from services.odds_api import fetch_all_sport_odds, find_match_odds
    from database import update_match_odds
    from sqlalchemy import select

    all_events = await fetch_all_sport_odds()
    if not all_events:
        logger.info("No odds data returned — skipping odds sync")
        return

    now_naive = datetime.now(timezone.utc).replace(tzinfo=None)
    cutoff = (datetime.now(timezone.utc) + timedelta(days=4)).replace(tzinfo=None)

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Match).where(
                Match.status == "scheduled",
                Match.match_time > now_naive,
                Match.match_time <= cutoff,
            )
        )
        matches = list(result.scalars().all())

    updated = 0
    for match in matches:
        odds = find_match_odds(all_events, match.home_team, match.away_team, match.match_time)
        if odds and any(v is not None for v in odds.values()):
            async with AsyncSessionLocal() as session:
                await update_match_odds(session, match.id, **odds)
            updated += 1
            logger.info(
                "Odds synced: %s vs %s — H:%.2f D:%.2f A:%.2f",
                match.home_team,
                match.away_team,
                odds.get("odds_home") or 0,
                odds.get("odds_draw") or 0,
                odds.get("odds_away") or 0,
            )

    logger.info("Odds sync complete: %d/%d matches updated", updated, len(matches))


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
    """Send a reminder to all users to claim their daily P points."""
    async with AsyncSessionLocal() as session:
        telegram_ids = await get_all_user_telegram_ids(session)

    for tid in telegram_ids:
        try:
            await app.bot.send_message(
                chat_id=tid,
                text=(
                    "⚽ *AI119 Football Predictor*\n\n"
                    "📅 Your daily *10,000 P* is ready!\n"
                    "Type /daily to claim it."
                ),
                parse_mode="Markdown",
            )
        except Exception:
            pass

    logger.info("Daily reminder sent to %d users", len(telegram_ids))


async def broadcast_pre_match_alert(app: Application) -> None:
    """Broadcast hourly pre-match marketing to GROUP_CHAT_ID for 12 hours before kick-off.

    Each match gets one broadcast per hour: 12h, 11h, 10h, ... 1h before kick-off.
    The job runs every 5 minutes; we fire when we're within ±5 min of the target slot.
    """
    if not GROUP_CHAT_ID:
        return

    from sqlalchemy import select

    now_utc = datetime.now(timezone.utc)
    now_naive = now_utc.replace(tzinfo=None)
    # Look ahead 12.5 hours to catch the 12h slot
    window_end = (now_utc + timedelta(hours=12, minutes=30)).replace(tzinfo=None)

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Match).where(
                Match.status == "scheduled",
                Match.match_time > now_naive,
                Match.match_time <= window_end,
            )
        )
        upcoming = list(result.scalars().all())

    for match in upcoming:
        minutes_remaining = (match.match_time - now_naive).total_seconds() / 60

        # Determine which hourly slot (1–12 h before kick-off)
        hours_before = round(minutes_remaining / 60)
        if hours_before < 1 or hours_before > 12:
            continue

        # Only send within a ±5-minute window around the target slot
        target_minutes = hours_before * 60
        if abs(minutes_remaining - target_minutes) > 5:
            continue

        if (match.id, hours_before) in _pre_alert_sent:
            continue

        bot_username = app.bot.username or ""
        predict_url = (
            f"https://t.me/{bot_username}?start=predict"
            if bot_username
            else "https://t.me/ai119"
        )

        if hours_before == 1:
            countdown_ko = "⏰ 킥오프까지 *1시간* 남았습니다!"
            countdown_en = "⏰ *1 hour* until kick-off!"
            countdown_vi = "⏰ Còn *1 giờ* nữa là kick-off!"
        else:
            countdown_ko = f"⏰ 킥오프까지 *{hours_before}시간* 남았습니다!"
            countdown_en = f"⏰ *{hours_before} hours* until kick-off!"
            countdown_vi = f"⏰ Còn *{hours_before} giờ* nữa là kick-off!"

        text = (
            f"🔥 *경기 예고! / Match Countdown!*\n\n"
            f"🏆 {match.league}\n"
            f"🆚 *{match.home_team}* vs *{match.away_team}*\n"
            f"{countdown_ko}\n"
            f"{countdown_en}\n"
            f"{countdown_vi}\n\n"
            f"🎯 무료 *P포인트*로 승무패를 맞춰보세요!\n"
            f"🎯 Predict 1X2 using your free *P points* and win!\n"
            f"🎯 Dùng *P miễn phí* để dự đoán kết quả!\n\n"
            f"💡 P포인트로 AI119 유료 서비스 이용 가능!\n"
            f"💡 Use P points for AI119 premium services!\n"
            f"💡 Dùng điểm P để trải nghiệm dịch vụ trả phí AI119!\n\n"
            f"🎟️ 매일 *10,000 P* 무료! /daily 로 수령하세요"
        )

        keyboard = InlineKeyboardMarkup([
            [
                InlineKeyboardButton("⚽ 배팅하기 / Bet Now", url=predict_url),
                InlineKeyboardButton("⚽ Football Community", url="https://t.me/globalSoccer_b"),
            ],
            [InlineKeyboardButton("🌐 AI119 유료 서비스 / Premium", url=SITE_URL)],
        ])

        try:
            await app.bot.send_message(
                chat_id=GROUP_CHAT_ID,
                text=text,
                parse_mode="Markdown",
                reply_markup=keyboard,
            )
            _pre_alert_sent.add((match.id, hours_before))
            logger.info(
                "Pre-match alert sent for match %d (%s vs %s) — %dh before",
                match.id, match.home_team, match.away_team, hours_before,
            )
        except Exception as exc:
            logger.error("Failed to send pre-match alert: %s", exc)


async def broadcast_live_update(app: Application) -> None:
    """Send live score briefing to GROUP_CHAT_ID every 15 minutes for ongoing matches."""
    if not GROUP_CHAT_ID:
        return

    from services.football_api import fetch_live_score
    from sqlalchemy import select

    now_utc = datetime.now(timezone.utc)
    # Matches started up to 3 hours ago (covers 90 min + extra time)
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
        elapsed_label = ""

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
                    f"*{match.home_team}* {hs} — {aws} *{match.away_team}*\n"
                    f"🔴 {status_label}"
                )
                elapsed_min = live_data.get("elapsed")
                if elapsed_min:
                    elapsed_label = f"⏱ {elapsed_min}분 경과 / {elapsed_min} min elapsed\n"

        text = (
            f"📡 *경기 중계 / Live Briefing*\n\n"
            f"🏆 {match.league}\n"
            f"⚽ {score_line}\n"
            f"{elapsed_label}\n"
            f"👥 예측 참여자: *{pred_count}명* / Predictors: *{pred_count}*\n\n"
            f"🎯 아직 예측하지 않았다면 지금 참여하세요!\n"
            f"🎯 Haven't predicted yet? Join now!\n"
            f"🎯 Chưa dự đoán? Tham gia ngay!\n\n"
            f"💡 P포인트로 AI119 유료 서비스 이용 가능!\n"
            f"💡 Use P points for AI119 premium services!"
        )

        keyboard = InlineKeyboardMarkup([
            [
                InlineKeyboardButton("⚽ 배팅 참여 / Join Bet", url=predict_url),
                InlineKeyboardButton("⚽ Football Community", url="https://t.me/globalSoccer_b"),
            ],
            [InlineKeyboardButton("🌐 AI119 유료 서비스 / Premium", url=SITE_URL)],
        ])

        try:
            await app.bot.send_message(
                chat_id=GROUP_CHAT_ID,
                text=text,
                parse_mode="Markdown",
                reply_markup=keyboard,
            )
            logger.info(
                "Live briefing sent for match %d (%s vs %s)",
                match.id, match.home_team, match.away_team,
            )
        except Exception as exc:
            logger.error("Failed to send live briefing: %s", exc)


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
        f"⚽ *{match.home_team}* {home_score} — {away_score} *{match.away_team}*\n\n"
        f"{result_text}\n\n"
        f"📊 *정산 결과 / Settlement Results*\n"
        f"👥 승리자: *{winners}명* / Winners: *{winners}*\n"
        f"🏅 승리자 총 지급: *{payout:,} P*\n\n"
        f"🎟️ P포인트로 AI119 유료 서비스를 이용하세요!\n"
        f"🎟️ Use your P points for AI119 premium services!\n"
        f"🎟️ Dùng điểm P để trải nghiệm dịch vụ AI119!\n\n"
        f"🎯 다음 경기를 예측하고 P 포인트를 획득하세요!\n"
        f"🎯 Predict the next match and earn more P!\n"
        f"🎯 Dự đoán trận tiếp theo để nhận thêm P!"
    )

    bot_username = app.bot.username or ""
    predict_url = (
        f"https://t.me/{bot_username}?start=predict"
        if bot_username
        else "https://t.me/ai119"
    )

    keyboard = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("⚽ 다음 경기 배팅 / Next Match Bet", url=predict_url),
            InlineKeyboardButton("⚽ Football Community", url="https://t.me/globalSoccer_b"),
        ],
        [InlineKeyboardButton("🌐 AI119 유료 서비스 / Premium", url=SITE_URL)],
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
