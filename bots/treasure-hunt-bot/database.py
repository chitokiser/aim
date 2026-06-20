"""Firestore-backed database layer for the treasure hunt bot.

Collections (th_ prefix to avoid collisions with other bots sharing the aim119 project):
  th_counters/seq                  - {treasure_id: N}
  th_treasures/{id}                - Treasure documents
  th_questions/{treasure_id}_{n}   - Question documents (doc ID == Question.id)
  th_attempts/{user_id}_{tid}      - UserAttempt documents
  th_hints/{user_id}_{question_id} - {levels: [1, 2, ...]}
  th_gp/{user_id}                  - {gp, lang, username}
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional

import firebase_admin
from firebase_admin import credentials, firestore_async
from google.cloud.firestore_v1 import SERVER_TIMESTAMP

from config import FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_PROJECT_ID


def _parse_answer(val) -> int:
    """Convert AI answer field to 0-indexed int in range 0-3."""
    if isinstance(val, str):
        v = val.strip().upper()
        if v in ("A", "B", "C", "D"):
            return {"A": 0, "B": 1, "C": 2, "D": 3}[v]
        try:
            val = int(v)
        except ValueError:
            return 0
    try:
        return max(0, min(3, int(val)))
    except (ValueError, TypeError):
        return 0


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
# Dataclasses  (same attribute names as the old SQLAlchemy models)
# ---------------------------------------------------------------------------

@dataclass
class Treasure:
    id: int
    latitude: float
    longitude: float
    location_name: str
    prize_gp: int
    prize_description: str
    created_by: int
    group_chat_id: int
    is_active: bool = True
    is_found: bool = False
    found_by: Optional[int] = None
    created_at: Optional[datetime] = None


@dataclass
class Question:
    id: str          # "{treasure_id}_{order_num}" — string, not int
    treasure_id: int
    order_num: int
    question_text: str
    correct_option: int = 0   # 0=A 1=B 2=C 3=D
    option_a: str = ""
    option_b: str = ""
    option_c: str = ""
    option_d: str = ""
    hint1: str = ""
    hint2: str = ""
    hint3: str = ""
    hint1_cost: int = 10
    hint2_cost: int = 20
    hint3_cost: int = 30


@dataclass
class UserAttempt:
    user_id: int
    username: str
    treasure_id: int
    current_question: int = 1
    wrong_count: int = 0
    is_completed: bool = False
    is_failed: bool = False
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


@dataclass
class UserGP:
    user_id: int
    username: str
    gp: int = 0
    lang: str = "en"


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


def _to_treasure(data: dict, doc_id: str) -> Treasure:
    return Treasure(
        id=data.get("id", int(doc_id)),
        latitude=data.get("latitude", 0.0),
        longitude=data.get("longitude", 0.0),
        location_name=data.get("location_name", ""),
        prize_gp=data.get("prize_gp", 0),
        prize_description=data.get("prize_description", ""),
        created_by=data.get("created_by", 0),
        group_chat_id=data.get("group_chat_id", 0),
        is_active=data.get("is_active", True),
        is_found=data.get("is_found", False),
        found_by=data.get("found_by"),
        created_at=_ts_to_dt(data.get("created_at")),
    )


def _to_question(data: dict, doc_id: str) -> Question:
    return Question(
        id=doc_id,
        treasure_id=data.get("treasure_id", 0),
        order_num=data.get("order_num", 0),
        question_text=data.get("question_text", ""),
        correct_option=data.get("correct_option", 0),
        option_a=data.get("option_a", ""),
        option_b=data.get("option_b", ""),
        option_c=data.get("option_c", ""),
        option_d=data.get("option_d", ""),
        hint1=data.get("hint1", ""),
        hint2=data.get("hint2", ""),
        hint3=data.get("hint3", ""),
        hint1_cost=data.get("hint1_cost", 10),
        hint2_cost=data.get("hint2_cost", 20),
        hint3_cost=data.get("hint3_cost", 30),
    )


def _to_attempt(data: dict) -> UserAttempt:
    return UserAttempt(
        user_id=data.get("user_id", 0),
        username=data.get("username", ""),
        treasure_id=data.get("treasure_id", 0),
        current_question=data.get("current_question", 1),
        wrong_count=data.get("wrong_count", 0),
        is_completed=data.get("is_completed", False),
        is_failed=data.get("is_failed", False),
        started_at=_ts_to_dt(data.get("started_at")),
        completed_at=_ts_to_dt(data.get("completed_at")),
    )


def _to_gp(data: dict, user_id: int) -> UserGP:
    return UserGP(
        user_id=user_id,
        username=data.get("username", ""),
        gp=data.get("gp", 0),
        lang=data.get("lang", "en"),
    )


async def _next_treasure_id() -> int:
    ref = db.collection("th_counters").document("seq")
    doc = await ref.get()
    current = doc.to_dict().get("treasure_id", 0) if doc.exists else 0
    new_id = current + 1
    await ref.set({"treasure_id": new_id}, merge=True)
    return new_id


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def init_db() -> None:
    pass  # Firestore requires no schema initialization


async def create_treasure(
    latitude: float,
    longitude: float,
    location_name: str,
    prize_gp: int,
    prize_description: str,
    created_by: int,
    group_chat_id: int,
) -> Treasure:
    treasure_id = await _next_treasure_id()
    data = {
        "id": treasure_id,
        "latitude": latitude,
        "longitude": longitude,
        "location_name": location_name,
        "prize_gp": prize_gp,
        "prize_description": prize_description,
        "created_by": created_by,
        "group_chat_id": group_chat_id,
        "is_active": True,
        "is_found": False,
        "found_by": None,
        "created_at": SERVER_TIMESTAMP,
    }
    await db.collection("th_treasures").document(str(treasure_id)).set(data)
    return Treasure(
        id=treasure_id,
        latitude=latitude,
        longitude=longitude,
        location_name=location_name,
        prize_gp=prize_gp,
        prize_description=prize_description,
        created_by=created_by,
        group_chat_id=group_chat_id,
    )


async def save_questions(treasure_id: int, questions: list[dict]) -> None:
    for i, q in enumerate(questions, 1):
        options = q.get("options", [])
        hints = q.get("hints", [])
        doc_id = f"{treasure_id}_{i}"
        await db.collection("th_questions").document(doc_id).set({
            "treasure_id": treasure_id,
            "order_num": i,
            "question_text": q.get("question", ""),
            "correct_option": _parse_answer(q.get("answer", 0)),
            "option_a": options[0] if len(options) > 0 else "",
            "option_b": options[1] if len(options) > 1 else "",
            "option_c": options[2] if len(options) > 2 else "",
            "option_d": options[3] if len(options) > 3 else "",
            "hint1": hints[0] if len(hints) > 0 else "",
            "hint2": hints[1] if len(hints) > 1 else "",
            "hint3": hints[2] if len(hints) > 2 else "",
            "hint1_cost": 100,
            "hint2_cost": 300,
            "hint3_cost": 500,
        })


async def get_active_treasures(user_id: int) -> list[Treasure]:
    results = []
    async for doc in db.collection("th_treasures").stream():
        data = doc.to_dict()
        if data.get("is_active") and not data.get("is_found"):
            results.append(_to_treasure(data, doc.id))
    return results


async def get_treasure(treasure_id: int) -> Optional[Treasure]:
    doc = await db.collection("th_treasures").document(str(treasure_id)).get()
    if not doc.exists:
        return None
    return _to_treasure(doc.to_dict(), doc.id)


async def get_question_by_order(treasure_id: int, order_num: int) -> Optional[Question]:
    doc_id = f"{treasure_id}_{order_num}"
    doc = await db.collection("th_questions").document(doc_id).get()
    if not doc.exists:
        return None
    return _to_question(doc.to_dict(), doc.id)


async def question_count(treasure_id: int) -> int:
    count = 0
    async for _ in db.collection("th_questions").where("treasure_id", "==", treasure_id).stream():
        count += 1
    return count


async def get_or_create_attempt(user_id: int, username: str, treasure_id: int) -> UserAttempt:
    doc_id = f"{user_id}_{treasure_id}"
    doc = await db.collection("th_attempts").document(doc_id).get()
    if doc.exists:
        return _to_attempt(doc.to_dict())
    data = {
        "user_id": user_id,
        "username": username,
        "treasure_id": treasure_id,
        "current_question": 1,
        "wrong_count": 0,
        "is_completed": False,
        "is_failed": False,
        "started_at": SERVER_TIMESTAMP,
        "completed_at": None,
    }
    await db.collection("th_attempts").document(doc_id).set(data)
    return UserAttempt(user_id=user_id, username=username, treasure_id=treasure_id)


async def get_attempt(user_id: int, treasure_id: int) -> Optional[UserAttempt]:
    doc_id = f"{user_id}_{treasure_id}"
    doc = await db.collection("th_attempts").document(doc_id).get()
    if not doc.exists:
        return None
    return _to_attempt(doc.to_dict())


async def update_attempt(user_id: int, treasure_id: int, **kwargs) -> None:
    doc_id = f"{user_id}_{treasure_id}"
    await db.collection("th_attempts").document(doc_id).update(kwargs)


async def get_gp(user_id: int, username: str = None) -> UserGP:
    doc = await db.collection("th_gp").document(str(user_id)).get()
    if doc.exists:
        return _to_gp(doc.to_dict(), user_id)
    data: dict = {"user_id": user_id, "gp": 0, "lang": "en"}
    if username:
        data["username"] = username
    await db.collection("th_gp").document(str(user_id)).set(data)
    return UserGP(user_id=user_id, username=username or "", gp=0)


async def deduct_gp(user_id: int, amount: int) -> bool:
    ref = db.collection("th_gp").document(str(user_id))
    doc = await ref.get()
    if not doc.exists:
        return False
    current = doc.to_dict().get("gp", 0)
    if current < amount:
        return False
    await ref.update({"gp": current - amount})
    return True


async def get_lang(user_id: int) -> str:
    doc = await db.collection("th_gp").document(str(user_id)).get()
    if doc.exists:
        return doc.to_dict().get("lang", "en")
    return "en"


async def set_lang(user_id: int, lang: str, username: str = None) -> None:
    updates: dict = {"lang": lang}
    if username:
        updates["username"] = username
    await db.collection("th_gp").document(str(user_id)).set(updates, merge=True)


async def get_purchased_hints(user_id: int, question_id: str) -> set[int]:
    doc_id = f"{user_id}_{question_id}"
    doc = await db.collection("th_hints").document(doc_id).get()
    if not doc.exists:
        return set()
    return set(doc.to_dict().get("levels", []))


async def record_hint_purchase(user_id: int, question_id: str, level: int, cost: int) -> None:
    doc_id = f"{user_id}_{question_id}"
    ref = db.collection("th_hints").document(doc_id)
    doc = await ref.get()
    if doc.exists:
        existing = set(doc.to_dict().get("levels", []))
        existing.add(level)
        await ref.update({"levels": list(existing)})
    else:
        await ref.set({"user_id": user_id, "question_id": question_id, "levels": [level]})
    await deduct_gp(user_id, cost)


# ---------------------------------------------------------------------------
# Admin stats helper
# ---------------------------------------------------------------------------

async def get_stats() -> dict:
    total_treasures = 0
    active_treasures = 0
    async for doc in db.collection("th_treasures").stream():
        total_treasures += 1
        if doc.to_dict().get("is_active"):
            active_treasures += 1

    total_attempts = 0
    completions = 0
    async for doc in db.collection("th_attempts").stream():
        total_attempts += 1
        if doc.to_dict().get("is_completed"):
            completions += 1

    total_players = 0
    async for _ in db.collection("th_gp").stream():
        total_players += 1

    return {
        "total_treasures": total_treasures,
        "active_treasures": active_treasures,
        "total_attempts": total_attempts,
        "completions": completions,
        "total_players": total_players,
    }
