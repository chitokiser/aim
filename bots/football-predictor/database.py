"""Firestore-backed database layer for the football-predictor bot.

Collections (fp_ prefix to avoid collisions):
  fp_counters/seq              - {match_id: N}
  fp_users/{telegram_id}       - User documents
  fp_matches/{match_id}        - Match documents
  fp_predictions/{uid}_{mid}   - Prediction documents

Handler compatibility layer:
  AsyncSessionLocal() returns a no-op dummy context manager so ALL existing
  handler code (async with AsyncSessionLocal() as session:) works unchanged.
  All public db functions accept a session arg but ignore it.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, date
from typing import Optional, List

import firebase_admin
from firebase_admin import credentials, firestore_async
from google.cloud.firestore_v1 import SERVER_TIMESTAMP

from config import FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_PROJECT_ID


# ---------------------------------------------------------------------------
# Firebase init
# ---------------------------------------------------------------------------

def _init_firebase() -> None:
    try:
        cred = credentials.Certificate({
            "type": "service_account",
            "project_id": FIREBASE_PROJECT_ID,
            "client_email": FIREBASE_CLIENT_EMAIL,
            "private_key": FIREBASE_PRIVATE_KEY,
            "token_uri": "https://oauth2.googleapis.com/token",
        })
        firebase_admin.initialize_app(cred)
    except ValueError:
        pass  # already initialized in this process


_init_firebase()
db = firestore_async.client()


# ---------------------------------------------------------------------------
# Dummy session — keeps all handler code (async with AsyncSessionLocal()) intact
# ---------------------------------------------------------------------------

class _DummySession:
    pass


class _DummyContext:
    async def __aenter__(self) -> _DummySession:
        return _DummySession()

    async def __aexit__(self, *args) -> None:
        pass


def AsyncSessionLocal() -> _DummyContext:
    return _DummyContext()


# ---------------------------------------------------------------------------
# Dataclasses  (same attribute names as the old SQLAlchemy models)
# ---------------------------------------------------------------------------

@dataclass
class User:
    id: int               # = telegram_id (no separate integer PK)
    telegram_id: int
    username: str = ""
    first_name: str = ""
    language: str = "en"
    p_balance: int = 0
    correct_predictions: int = 0
    total_predicted: int = 0
    total_ap_won: int = 0
    win_streak: int = 0
    streak_days: int = 0
    last_daily: Optional[str] = None   # "YYYY-MM-DD"


@dataclass
class Match:
    id: int
    home_team: str
    away_team: str
    league: str
    match_time: datetime
    status: str = "scheduled"
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    external_id: Optional[int] = None
    odds_home: Optional[float] = None
    odds_draw: Optional[float] = None
    odds_away: Optional[float] = None
    odds_btts_yes: Optional[float] = None
    odds_btts_no: Optional[float] = None
    odds_over25: Optional[float] = None
    odds_under25: Optional[float] = None
    ai_analysis: Optional[str] = None


@dataclass
class Prediction:
    user_id: int       # = telegram_id
    match_id: int
    pred_type: str
    pred_value: str
    stake_ap: int
    payout_ap: int
    stake_currency: str = "p"
    status: str = "pending"
    created_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _ts_to_dt(ts) -> Optional[datetime]:
    if ts is None:
        return None
    if isinstance(ts, datetime):
        return ts.replace(tzinfo=None) if ts.tzinfo else ts
    if hasattr(ts, "ToDatetime"):
        return ts.ToDatetime()
    return None


def _to_user(data: dict) -> User:
    tid = data.get("telegram_id", 0)
    return User(
        id=tid,
        telegram_id=tid,
        username=data.get("username", ""),
        first_name=data.get("first_name", ""),
        language=data.get("language", "en"),
        p_balance=data.get("p_balance", 0),
        correct_predictions=data.get("correct_predictions", 0),
        total_predicted=data.get("total_predicted", 0),
        total_ap_won=data.get("total_ap_won", 0),
        win_streak=data.get("win_streak", 0),
        streak_days=data.get("streak_days", 0),
        last_daily=data.get("last_daily"),
    )


def _to_match(data: dict, doc_id: str) -> Match:
    return Match(
        id=data.get("id", int(doc_id)),
        home_team=data.get("home_team", ""),
        away_team=data.get("away_team", ""),
        league=data.get("league", ""),
        match_time=_ts_to_dt(data.get("match_time")) or datetime.utcnow(),
        status=data.get("status", "scheduled"),
        home_score=data.get("home_score"),
        away_score=data.get("away_score"),
        external_id=data.get("external_id"),
        odds_home=data.get("odds_home"),
        odds_draw=data.get("odds_draw"),
        odds_away=data.get("odds_away"),
        odds_btts_yes=data.get("odds_btts_yes"),
        odds_btts_no=data.get("odds_btts_no"),
        odds_over25=data.get("odds_over25"),
        odds_under25=data.get("odds_under25"),
        ai_analysis=data.get("ai_analysis"),
    )


def _to_prediction(data: dict) -> Prediction:
    return Prediction(
        user_id=data.get("user_id", 0),
        match_id=data.get("match_id", 0),
        pred_type=data.get("pred_type", ""),
        pred_value=data.get("pred_value", ""),
        stake_ap=data.get("stake_ap", 0),
        payout_ap=data.get("payout_ap", 0),
        stake_currency=data.get("stake_currency", "p"),
        status=data.get("status", "pending"),
        created_at=_ts_to_dt(data.get("created_at")),
    )


async def _next_match_id() -> int:
    ref = db.collection("fp_counters").document("seq")
    doc = await ref.get()
    current = doc.to_dict().get("match_id", 0) if doc.exists else 0
    new_id = current + 1
    await ref.set({"match_id": new_id}, merge=True)
    return new_id


# ---------------------------------------------------------------------------
# DB init (no-op for Firestore)
# ---------------------------------------------------------------------------

async def init_db() -> None:
    pass


# ---------------------------------------------------------------------------
# Main platform freePoints — single source of truth
# ---------------------------------------------------------------------------

async def _get_main_freepoints(telegram_id: int) -> Optional[int]:
    """Return freePoints from main users collection, or None if user not registered there."""
    try:
        async for doc in db.collection("users").where("telegramId", "==", str(telegram_id)).limit(1).stream():
            return doc.to_dict().get("freePoints", 0) or 0
    except Exception:
        pass
    return None


async def _sync_main_freepoints(telegram_id: int, delta: int) -> None:
    """Apply a P delta directly to the main users collection's freePoints field."""
    if delta == 0:
        return
    try:
        async for doc in db.collection("users").where("telegramId", "==", str(telegram_id)).limit(1).stream():
            current = doc.to_dict().get("freePoints", 0) or 0
            new_val = max(0, current + delta)
            await db.collection("users").document(doc.id).update({"freePoints": new_val})
            return
    except Exception:
        pass  # never crash the bot if sync fails


# ---------------------------------------------------------------------------
# User functions
# ---------------------------------------------------------------------------

async def get_or_create_user(session, telegram_id: int, username: str = "", first_name: str = "", language: str = "en", welcome_p: int = 0) -> tuple["User", bool]:
    ref = db.collection("fp_users").document(str(telegram_id))
    doc = await ref.get()
    if doc.exists:
        user = _to_user(doc.to_dict())
        main_p = await _get_main_freepoints(telegram_id)
        if main_p is not None:
            user.p_balance = main_p
        return user, False
    data = {
        "telegram_id": telegram_id,
        "username": username,
        "first_name": first_name,
        "language": language,
        "p_balance": welcome_p,
        "correct_predictions": 0,
        "total_predicted": 0,
        "total_ap_won": 0,
        "win_streak": 0,
        "streak_days": 0,
        "last_daily": None,
    }
    await ref.set(data)
    return _to_user(data), True


async def get_user(session, telegram_id: int) -> Optional[User]:
    doc = await db.collection("fp_users").document(str(telegram_id)).get()
    if not doc.exists:
        return None
    user = _to_user(doc.to_dict())
    main_p = await _get_main_freepoints(telegram_id)
    if main_p is not None:
        user.p_balance = main_p
    return user


async def update_user(session, telegram_id: int, **kwargs) -> None:
    await db.collection("fp_users").document(str(telegram_id)).update(kwargs)


async def add_welcome_bonus(session, user: User, bonus: int) -> None:
    ref = db.collection("fp_users").document(str(user.telegram_id))
    doc = await ref.get()
    current = doc.to_dict().get("p_balance", 0) if doc.exists else 0
    await ref.update({"p_balance": current + bonus})
    user.p_balance = current + bonus
    await _sync_main_freepoints(user.telegram_id, bonus)


async def claim_daily(session, user: User, amount: int) -> tuple[bool, str]:
    today = date.today().isoformat()
    if user.last_daily == today:
        return False, "already_claimed"
    ref = db.collection("fp_users").document(str(user.telegram_id))
    new_balance = user.p_balance + amount
    new_streak = user.streak_days + 1
    await ref.update({
        "p_balance": new_balance,
        "last_daily": today,
        "streak_days": new_streak,
    })
    user.p_balance = new_balance
    user.last_daily = today
    user.streak_days = new_streak
    await _sync_main_freepoints(user.telegram_id, amount)
    return True, "ok"


async def get_leaderboard(session, limit: int = 10) -> List[User]:
    users = []
    async for doc in db.collection("fp_users").stream():
        users.append(_to_user(doc.to_dict()))
    users.sort(key=lambda u: u.correct_predictions, reverse=True)
    return users[:limit]


async def get_all_user_telegram_ids(session) -> List[int]:
    ids = []
    async for doc in db.collection("fp_users").stream():
        data = doc.to_dict()
        tid = data.get("telegram_id")
        if tid:
            ids.append(tid)
    return ids


# ---------------------------------------------------------------------------
# Match functions
# ---------------------------------------------------------------------------

async def add_match(
    session,
    home_team: str,
    away_team: str,
    league: str,
    match_time: datetime,
    external_id: Optional[int] = None,
) -> Match:
    match_id = await _next_match_id()
    mt = match_time
    if isinstance(mt, datetime) and mt.tzinfo is not None:
        from datetime import timezone
        mt = mt.astimezone(timezone.utc).replace(tzinfo=None)
    data = {
        "id": match_id,
        "home_team": home_team,
        "away_team": away_team,
        "league": league,
        "match_time": mt,
        "status": "scheduled",
        "home_score": None,
        "away_score": None,
        "external_id": external_id,
        "odds_home": None,
        "odds_draw": None,
        "odds_away": None,
        "odds_btts_yes": None,
        "odds_btts_no": None,
        "odds_over25": None,
        "odds_under25": None,
        "ai_analysis": None,
    }
    await db.collection("fp_matches").document(str(match_id)).set(data)
    return Match(
        id=match_id,
        home_team=home_team,
        away_team=away_team,
        league=league,
        match_time=mt,
        external_id=external_id,
    )


async def get_match(session, match_id: int) -> Optional[Match]:
    doc = await db.collection("fp_matches").document(str(match_id)).get()
    if not doc.exists:
        return None
    return _to_match(doc.to_dict(), doc.id)


async def get_upcoming_matches(session, limit: int = 50) -> List[Match]:
    now = datetime.utcnow()
    matches = []
    async for doc in db.collection("fp_matches").stream():
        data = doc.to_dict()
        mt = _ts_to_dt(data.get("match_time"))
        if mt and mt > now and data.get("status") == "scheduled":
            matches.append(_to_match(data, doc.id))
    matches.sort(key=lambda m: m.match_time)
    return matches[:limit]


async def get_all_matches(session) -> List[Match]:
    matches = []
    async for doc in db.collection("fp_matches").stream():
        matches.append(_to_match(doc.to_dict(), doc.id))
    matches.sort(key=lambda m: m.match_time, reverse=True)
    return matches


async def update_match_odds(session, match_id: int, **kwargs) -> None:
    await db.collection("fp_matches").document(str(match_id)).update(kwargs)


async def update_match_status(session, match_id: int, status: str, home_score: int = None, away_score: int = None) -> None:
    updates: dict = {"status": status}
    if home_score is not None:
        updates["home_score"] = home_score
    if away_score is not None:
        updates["away_score"] = away_score
    await db.collection("fp_matches").document(str(match_id)).update(updates)


# ---------------------------------------------------------------------------
# Scheduler-specific match helpers (used by services/scheduler.py)
# ---------------------------------------------------------------------------

async def get_match_by_external_id(external_id: int) -> Optional[Match]:
    async for doc in db.collection("fp_matches").stream():
        data = doc.to_dict()
        if data.get("external_id") == external_id:
            return _to_match(data, doc.id)
    return None


async def get_scheduled_matches_in_window(from_dt: datetime, to_dt: datetime) -> List[Match]:
    matches = []
    async for doc in db.collection("fp_matches").stream():
        data = doc.to_dict()
        if data.get("status") != "scheduled":
            continue
        mt = _ts_to_dt(data.get("match_time"))
        if mt and from_dt <= mt <= to_dt:
            matches.append(_to_match(data, doc.id))
    return matches


async def get_live_matches_in_window(from_dt: datetime, to_dt: datetime) -> List[Match]:
    matches = []
    async for doc in db.collection("fp_matches").stream():
        data = doc.to_dict()
        if data.get("status") not in ("live", "scheduled"):
            continue
        mt = _ts_to_dt(data.get("match_time"))
        if mt and from_dt <= mt <= to_dt:
            matches.append(_to_match(data, doc.id))
    return matches


async def get_past_active_matches_with_external_id(cutoff: datetime) -> List[Match]:
    matches = []
    async for doc in db.collection("fp_matches").stream():
        data = doc.to_dict()
        if data.get("status") not in ("scheduled", "live"):
            continue
        if not data.get("external_id"):
            continue
        mt = _ts_to_dt(data.get("match_time"))
        if mt and mt < cutoff:
            matches.append(_to_match(data, doc.id))
    return matches


# ---------------------------------------------------------------------------
# Prediction functions
# ---------------------------------------------------------------------------

async def create_prediction(
    session,
    user: User,
    match_id: int,
    pred_type: str,
    pred_value: str,
    stake_ap: int,
    payout_ap: int,
    stake_currency: str = "p",
) -> Prediction:
    doc_id = f"{user.telegram_id}_{match_id}_{pred_type}"
    data = {
        "user_id": user.telegram_id,
        "match_id": match_id,
        "pred_type": pred_type,
        "pred_value": pred_value,
        "stake_ap": stake_ap,
        "payout_ap": payout_ap,
        "stake_currency": stake_currency,
        "status": "pending",
        "created_at": SERVER_TIMESTAMP,
    }
    await db.collection("fp_predictions").document(doc_id).set(data)
    ref = db.collection("fp_users").document(str(user.telegram_id))
    doc = await ref.get()
    current_total = doc.to_dict().get("total_predicted", 0) if doc.exists else 0
    # Use main platform as source of truth for P balance
    current_balance = await _get_main_freepoints(user.telegram_id)
    if current_balance is None:
        current_balance = doc.to_dict().get("p_balance", 0) if doc.exists else 0
    actual_deduct = min(stake_ap, current_balance)
    await ref.update({
        "p_balance": max(0, current_balance - stake_ap),
        "total_predicted": current_total + 1,
    })
    await _sync_main_freepoints(user.telegram_id, -actual_deduct)
    return Prediction(
        user_id=user.telegram_id,
        match_id=match_id,
        pred_type=pred_type,
        pred_value=pred_value,
        stake_ap=stake_ap,
        payout_ap=payout_ap,
        stake_currency=stake_currency,
    )


async def get_user_predictions(session, telegram_id: int) -> List[Prediction]:
    preds = []
    async for doc in db.collection("fp_predictions").stream():
        data = doc.to_dict()
        if data.get("user_id") == telegram_id:
            preds.append(_to_prediction(data))
    preds.sort(key=lambda p: p.created_at or datetime.min, reverse=True)
    return preds


async def get_user_prediction_for_match(session, telegram_id: int, match_id: int) -> List[Prediction]:
    preds = []
    async for doc in db.collection("fp_predictions").stream():
        data = doc.to_dict()
        if data.get("user_id") == telegram_id and data.get("match_id") == match_id:
            preds.append(_to_prediction(data))
    return preds


async def count_predictions_for_match(session, match_id: int) -> int:
    count = 0
    async for doc in db.collection("fp_predictions").stream():
        if doc.to_dict().get("match_id") == match_id:
            count += 1
    return count


def _evaluate_prediction(pred: Prediction, home_score: int, away_score: int) -> bool:
    v = pred.pred_value
    if pred.pred_type in ("result", "1x2"):
        if v == "home" and home_score > away_score:
            return True
        if v == "draw" and home_score == away_score:
            return True
        if v == "away" and away_score > home_score:
            return True
    elif pred.pred_type == "btts":
        scored = home_score > 0 and away_score > 0
        return (v == "yes") == scored
    elif pred.pred_type == "over_under":
        total = home_score + away_score
        if v == "over_2.5":
            return total > 2
        if v == "under_2.5":
            return total < 3
    elif pred.pred_type == "exact":
        parts = v.split("-")
        if len(parts) == 2:
            try:
                return int(parts[0]) == home_score and int(parts[1]) == away_score
            except ValueError:
                pass
    return False


async def settle_match(session, match: Match, home_score: int, away_score: int) -> tuple[list[int], int]:
    await update_match_status(session, match.id, "finished", home_score, away_score)

    winners: list[int] = []
    total_payout = 0

    async for doc in db.collection("fp_predictions").stream():
        data = doc.to_dict()
        if data.get("match_id") != match.id or data.get("status") != "pending":
            continue
        pred = _to_prediction(data)
        won = _evaluate_prediction(pred, home_score, away_score)
        new_status = "won" if won else "lost"
        await db.collection("fp_predictions").document(doc.id).update({"status": new_status})

        if won:
            user_ref = db.collection("fp_users").document(str(pred.user_id))
            user_doc = await user_ref.get()
            if user_doc.exists:
                udata = user_doc.to_dict()
                main_p = await _get_main_freepoints(pred.user_id)
                current_p = main_p if main_p is not None else udata.get("p_balance", 0)
                await user_ref.update({
                    "p_balance": current_p + pred.payout_ap,
                    "correct_predictions": udata.get("correct_predictions", 0) + 1,
                    "total_ap_won": udata.get("total_ap_won", 0) + pred.payout_ap,
                })
                await _sync_main_freepoints(pred.user_id, pred.payout_ap)
            winners.append(pred.user_id)
            total_payout += pred.payout_ap

    return winners, total_payout


async def cancel_match_predictions(session, match: Match) -> int:
    count = 0
    async for doc in db.collection("fp_predictions").stream():
        data = doc.to_dict()
        if data.get("match_id") != match.id or data.get("status") != "pending":
            continue
        pred = _to_prediction(data)
        await db.collection("fp_predictions").document(doc.id).update({"status": "cancelled"})
        user_ref = db.collection("fp_users").document(str(pred.user_id))
        user_doc = await user_ref.get()
        if user_doc.exists:
            main_p = await _get_main_freepoints(pred.user_id)
            current = main_p if main_p is not None else user_doc.to_dict().get("p_balance", 0)
            await user_ref.update({"p_balance": current + pred.stake_ap})
            await _sync_main_freepoints(pred.user_id, pred.stake_ap)
        count += 1
    await update_match_status(session, match.id, "cancelled")
    return count


async def set_user_language(session, telegram_id: int, lang: str) -> None:
    await db.collection("fp_users").document(str(telegram_id)).update({"language": lang})


async def get_user_rank(session, telegram_id: int) -> int:
    users = []
    async for doc in db.collection("fp_users").stream():
        users.append(doc.to_dict())
    users.sort(key=lambda u: u.get("correct_predictions", 0), reverse=True)
    for i, u in enumerate(users, start=1):
        if u.get("telegram_id") == telegram_id:
            return i
    return 0


async def has_predicted(session, telegram_id: int, match_id: int) -> bool:
    async for doc in db.collection("fp_predictions").stream():
        data = doc.to_dict()
        if data.get("user_id") == telegram_id and data.get("match_id") == match_id and data.get("status") == "pending":
            return True
    return False


async def place_prediction(
    session,
    user: User,
    match_id: int,
    pred_type: str,
    pred_value: str,
    stake_ap: int,
    payout_ap: int,
    stake_currency: str = "p",
) -> Prediction:
    return await create_prediction(session, user, match_id, pred_type, pred_value, stake_ap, payout_ap, stake_currency)


async def get_user_predictions_with_matches(session, telegram_id: int) -> list[tuple[Prediction, Optional[Match]]]:
    preds = await get_user_predictions(session, telegram_id)
    result = []
    for pred in preds:
        match = await get_match(session, pred.match_id)
        result.append((pred, match))
    return result
