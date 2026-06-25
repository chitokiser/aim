from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import aiohttp

from config import FOOTBALL_API_KEY, FOOTBALL_API_BASE, COMPETITIONS

logger = logging.getLogger(__name__)

HEADERS = {"X-Auth-Token": FOOTBALL_API_KEY}


async def fetch_upcoming_matches(days_ahead: int = 3) -> list[dict]:
    """
    Fetch upcoming matches from football-data.org for the next N days.
    Returns list of dicts with keys: external_id, home_team, away_team, league, match_time.
    Returns [] if API key is missing or request fails.
    """
    if not FOOTBALL_API_KEY:
        logger.warning("FOOTBALL_API_KEY not set — skipping API fetch")
        return []

    now_utc = datetime.now(timezone.utc)
    date_from = now_utc.strftime("%Y-%m-%d")
    date_to = (now_utc + timedelta(days=days_ahead)).strftime("%Y-%m-%d")

    url = f"{FOOTBALL_API_BASE}/matches"
    params = {"dateFrom": date_from, "dateTo": date_to}

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=HEADERS, params=params, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    logger.warning("football-data.org returned %s: %s", resp.status, text[:200])
                    return []
                data = await resp.json()
    except Exception as exc:
        logger.error("football-data.org fetch error: %s", exc)
        return []

    all_matches = data.get("matches", [])
    logger.info("football-data.org returned %d total matches for %s–%s", len(all_matches), date_from, date_to)

    matches = []
    for m in all_matches:
        if m.get("status") in ("FINISHED", "CANCELLED", "POSTPONED", "SUSPENDED", "AWARDED"):
            continue
        competition_code = m.get("competition", {}).get("code", "")
        if competition_code not in COMPETITIONS:
            continue

        utc_date_str = m.get("utcDate", "")
        try:
            match_time = datetime.fromisoformat(utc_date_str.replace("Z", "+00:00"))
        except ValueError:
            continue

        matches.append({
            "external_id": m.get("id"),
            "home_team": m.get("homeTeam", {}).get("name", "Home"),
            "away_team": m.get("awayTeam", {}).get("name", "Away"),
            "league": m.get("competition", {}).get("name", competition_code),
            "match_time": match_time,
        })

    return matches


async def fetch_match_result(external_id: int) -> dict | None:
    """
    Fetch the final result of a specific match by its football-data.org ID.
    Returns dict with home_score, away_score, status or None on error.
    """
    if not FOOTBALL_API_KEY:
        return None

    url = f"{FOOTBALL_API_BASE}/matches/{external_id}"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=HEADERS, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status != 200:
                    return None
                data = await resp.json()
    except Exception as exc:
        logger.error("football-data.org match fetch error: %s", exc)
        return None

    score = data.get("score", {}).get("fullTime", {})
    status = data.get("status", "")
    if status != "FINISHED":
        return None

    return {
        "home_score": score.get("home"),
        "away_score": score.get("away"),
        "status": status,
    }


async def fetch_live_score(external_id: int) -> dict | None:
    """
    Fetch current score for a live or paused match.
    Returns dict with home_score, away_score, status or None if match hasn't started.
    """
    if not FOOTBALL_API_KEY:
        return None

    url = f"{FOOTBALL_API_BASE}/matches/{external_id}"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=HEADERS, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status != 200:
                    return None
                data = await resp.json()
    except Exception as exc:
        logger.error("football-data.org live score error: %s", exc)
        return None

    status = data.get("status", "")
    if status not in ("IN_PLAY", "PAUSED", "FINISHED"):
        return None

    score = data.get("score", {}) or {}
    full_time = score.get("fullTime", {}) or {}
    home_score = full_time.get("home") or 0
    away_score = full_time.get("away") or 0

    elapsed = data.get("minute")  # minute elapsed (int or None)

    return {
        "home_score": home_score,
        "away_score": away_score,
        "status": status,
        "elapsed": elapsed,
    }
