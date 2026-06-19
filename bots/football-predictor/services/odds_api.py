"""The Odds API v4 integration — fetch real bookmaker odds per match."""
from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from difflib import SequenceMatcher

import aiohttp

from config import ODDS_API_KEY

logger = logging.getLogger(__name__)

ODDS_API_BASE = "https://api.the-odds-api.com/v4"

# Map football-data.org competition codes to The Odds API sport keys
COMPETITION_TO_SPORT: dict[str, str] = {
    "PL": "soccer_epl",
    "CL": "soccer_uefa_champs_league",
    "PD": "soccer_spain_la_liga",
    "BL1": "soccer_germany_bundesliga",
    "SA": "soccer_italy_serie_a",
    "FL1": "soccer_france_ligue_one",
    "EC": "soccer_uefa_european_championship",
    "WC": "soccer_fifa_world_cup",
}

ALL_SPORT_KEYS = list(set(COMPETITION_TO_SPORT.values()))


def _normalize(name: str) -> str:
    name = name.lower()
    name = re.sub(r"\b(fc|cf|afc|sc|bc|ac|sv|united|utd|city|club|de|le|la)\b", " ", name)
    name = re.sub(r"[^a-z0-9\s]", "", name)
    return re.sub(r"\s+", " ", name).strip()


def _similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, _normalize(a), _normalize(b)).ratio()


def _extract_avg_odds(event: dict) -> dict:
    """Extract average bookmaker odds from an Odds API event dict."""
    home_name = event.get("home_team", "")
    away_name = event.get("away_team", "")

    h_list: list[float] = []
    d_list: list[float] = []
    a_list: list[float] = []
    btts_yes: list[float] = []
    btts_no: list[float] = []
    over25: list[float] = []
    under25: list[float] = []

    for bookmaker in event.get("bookmakers", []):
        for market in bookmaker.get("markets", []):
            key = market["key"]
            outcomes = market.get("outcomes", [])

            if key == "h2h":
                for o in outcomes:
                    price = o["price"]
                    name = o["name"]
                    if name == "Draw":
                        d_list.append(price)
                    elif _similarity(name, home_name) >= 0.6:
                        h_list.append(price)
                    elif _similarity(name, away_name) >= 0.6:
                        a_list.append(price)

            elif key == "btts":
                for o in outcomes:
                    if o["name"] == "Yes":
                        btts_yes.append(o["price"])
                    elif o["name"] == "No":
                        btts_no.append(o["price"])

            elif key == "totals":
                for o in outcomes:
                    if abs(o.get("point", 0) - 2.5) < 0.01:
                        if "Over" in o["name"]:
                            over25.append(o["price"])
                        elif "Under" in o["name"]:
                            under25.append(o["price"])

    def _avg(lst: list[float]) -> float | None:
        return round(sum(lst) / len(lst), 2) if lst else None

    return {
        "odds_home": _avg(h_list),
        "odds_draw": _avg(d_list),
        "odds_away": _avg(a_list),
        "odds_btts_yes": _avg(btts_yes),
        "odds_btts_no": _avg(btts_no),
        "odds_over25": _avg(over25),
        "odds_under25": _avg(under25),
    }


async def get_active_sport_keys() -> set[str]:
    """Return sport keys currently in-season according to The Odds API."""
    if not ODDS_API_KEY:
        return set()

    url = f"{ODDS_API_BASE}/sports/"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                url,
                params={"apiKey": ODDS_API_KEY},
                timeout=aiohttp.ClientTimeout(total=15),
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    active = {s["key"] for s in data if s.get("active")}
                    logger.info("Odds API active sports: %s", sorted(active))
                    return active
                logger.warning("Odds API /sports/ returned %d", resp.status)
    except Exception as exc:
        logger.error("Odds API sports list error: %s", exc)
    return set()


async def fetch_odds_for_sport(sport_key: str) -> list[dict]:
    """Fetch upcoming odds for a sport. Returns [] if key missing or request fails."""
    if not ODDS_API_KEY:
        return []

    url = f"{ODDS_API_BASE}/sports/{sport_key}/odds/"
    params = {
        "apiKey": ODDS_API_KEY,
        "regions": "eu",
        "markets": "h2h,btts,totals",
        "oddsFormat": "decimal",
    }
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                if resp.status == 200:
                    return await resp.json()
                body = await resp.text()
                logger.warning("Odds API [%s] returned %d: %s", sport_key, resp.status, body[:300])
    except Exception as exc:
        logger.error("Odds API fetch error [%s]: %s", sport_key, exc)
    return []


def find_match_odds(
    all_events: list[dict],
    home_team: str,
    away_team: str,
    match_time: datetime,
) -> dict | None:
    """Search all_events for an event matching home/away + date. Returns odds dict or None."""
    if match_time.tzinfo is None:
        match_time = match_time.replace(tzinfo=timezone.utc)

    for event in all_events:
        try:
            event_dt = datetime.fromisoformat(event["commence_time"].replace("Z", "+00:00"))
        except (KeyError, ValueError):
            continue

        # Matches must be within 30 hours of each other
        if abs((event_dt - match_time).total_seconds()) > 108000:
            continue

        if (
            _similarity(event.get("home_team", ""), home_team) >= 0.65
            and _similarity(event.get("away_team", ""), away_team) >= 0.65
        ):
            return _extract_avg_odds(event)

    return None


async def fetch_all_sport_odds() -> list[dict]:
    """Fetch odds for all tracked sports and return a flat list of events."""
    active_keys = await get_active_sport_keys()

    all_events: list[dict] = []
    for sport_key in ALL_SPORT_KEYS:
        if active_keys and sport_key not in active_keys:
            logger.debug("Odds API [%s] skipped — not in active season", sport_key)
            continue
        events = await fetch_odds_for_sport(sport_key)
        all_events.extend(events)
        if events:
            logger.info("Odds API [%s]: %d events", sport_key, len(events))
    return all_events
