"""Database models and helper functions for the Treasure Hunt Bot."""

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger, Boolean, DateTime, Float, ForeignKey,
    Integer, String, Text, func, and_, select,
)
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from config import DATABASE_URL, STARTING_GP

engine = create_async_engine(DATABASE_URL, echo=False)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


class Treasure(Base):
    __tablename__ = "treasures"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    location_name: Mapped[str] = mapped_column(String(512), default="")
    prize_gp: Mapped[int] = mapped_column(Integer)
    prize_description: Mapped[str] = mapped_column(String(512), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[int] = mapped_column(BigInteger)
    group_chat_id: Mapped[int] = mapped_column(BigInteger, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    questions: Mapped[list["Question"]] = relationship(
        "Question", back_populates="treasure", order_by="Question.order_num"
    )


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    treasure_id: Mapped[int] = mapped_column(Integer, ForeignKey("treasures.id"))
    order_num: Mapped[int] = mapped_column(Integer)
    question_text: Mapped[str] = mapped_column(Text)
    option_a: Mapped[str] = mapped_column(Text)
    option_b: Mapped[str] = mapped_column(Text)
    option_c: Mapped[str] = mapped_column(Text)
    option_d: Mapped[str] = mapped_column(Text)
    correct_option: Mapped[int] = mapped_column(Integer)  # 0=A, 1=B, 2=C, 3=D
    hint1: Mapped[str] = mapped_column(Text)
    hint2: Mapped[str] = mapped_column(Text)
    hint3: Mapped[str] = mapped_column(Text)

    treasure: Mapped["Treasure"] = relationship("Treasure", back_populates="questions")


class UserAttempt(Base):
    __tablename__ = "user_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger)
    username: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    treasure_id: Mapped[int] = mapped_column(Integer, ForeignKey("treasures.id"))
    is_failed: Mapped[bool] = mapped_column(Boolean, default=False)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    wrong_count: Mapped[int] = mapped_column(Integer, default=0)
    current_question: Mapped[int] = mapped_column(Integer, default=1)
    started_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class HintPurchase(Base):
    __tablename__ = "hint_purchases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger)
    question_id: Mapped[int] = mapped_column(Integer, ForeignKey("questions.id"))
    hint_level: Mapped[int] = mapped_column(Integer)  # 1, 2, or 3
    gp_cost: Mapped[int] = mapped_column(Integer)
    purchased_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class UserGP(Base):
    __tablename__ = "user_gp"

    user_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    username: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    balance: Mapped[int] = mapped_column(Integer, default=STARTING_GP)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


# ── Init ─────────────────────────────────────────────────────────────────────

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


# ── Treasure ─────────────────────────────────────────────────────────────────

async def create_treasure(
    latitude: float,
    longitude: float,
    location_name: str,
    prize_gp: int,
    prize_description: str,
    created_by: int,
    group_chat_id: int,
) -> Treasure:
    async with SessionLocal() as session:
        t = Treasure(
            latitude=latitude,
            longitude=longitude,
            location_name=location_name,
            prize_gp=prize_gp,
            prize_description=prize_description,
            created_by=created_by,
            group_chat_id=group_chat_id,
        )
        session.add(t)
        await session.commit()
        await session.refresh(t)
        return t


async def save_questions(treasure_id: int, questions: list[dict]) -> None:
    async with SessionLocal() as session:
        for i, q in enumerate(questions, 1):
            hints = q.get("hints", ["", "", ""])
            row = Question(
                treasure_id=treasure_id,
                order_num=i,
                question_text=q.get("question", ""),
                option_a=q["options"][0] if len(q.get("options", [])) > 0 else "",
                option_b=q["options"][1] if len(q.get("options", [])) > 1 else "",
                option_c=q["options"][2] if len(q.get("options", [])) > 2 else "",
                option_d=q["options"][3] if len(q.get("options", [])) > 3 else "",
                correct_option=int(q.get("answer", 0)),
                hint1=hints[0] if len(hints) > 0 else "",
                hint2=hints[1] if len(hints) > 1 else "",
                hint3=hints[2] if len(hints) > 2 else "",
            )
            session.add(row)
        await session.commit()


async def get_active_treasures(user_id: int) -> list[Treasure]:
    """Active treasures that the user has not failed."""
    async with SessionLocal() as session:
        failed_sub = select(UserAttempt.treasure_id).where(
            and_(UserAttempt.user_id == user_id, UserAttempt.is_failed == True)
        )
        result = await session.execute(
            select(Treasure)
            .where(and_(Treasure.is_active == True, ~Treasure.id.in_(failed_sub)))
            .order_by(Treasure.created_at.desc())
        )
        return list(result.scalars().all())


async def get_treasure(treasure_id: int) -> Optional[Treasure]:
    async with SessionLocal() as session:
        result = await session.execute(select(Treasure).where(Treasure.id == treasure_id))
        return result.scalar_one_or_none()


async def get_question_by_order(treasure_id: int, order_num: int) -> Optional[Question]:
    async with SessionLocal() as session:
        result = await session.execute(
            select(Question).where(
                and_(Question.treasure_id == treasure_id, Question.order_num == order_num)
            )
        )
        return result.scalar_one_or_none()


async def question_count(treasure_id: int) -> int:
    async with SessionLocal() as session:
        from sqlalchemy import func as sqlfunc
        result = await session.execute(
            select(sqlfunc.count()).select_from(Question).where(Question.treasure_id == treasure_id)
        )
        return result.scalar() or 0


# ── UserAttempt ───────────────────────────────────────────────────────────────

async def get_or_create_attempt(user_id: int, username: Optional[str], treasure_id: int) -> UserAttempt:
    async with SessionLocal() as session:
        result = await session.execute(
            select(UserAttempt).where(
                and_(UserAttempt.user_id == user_id, UserAttempt.treasure_id == treasure_id)
            )
        )
        attempt = result.scalar_one_or_none()
        if not attempt:
            attempt = UserAttempt(user_id=user_id, username=username, treasure_id=treasure_id)
            session.add(attempt)
            await session.commit()
            await session.refresh(attempt)
        return attempt


async def get_attempt(user_id: int, treasure_id: int) -> Optional[UserAttempt]:
    async with SessionLocal() as session:
        result = await session.execute(
            select(UserAttempt).where(
                and_(UserAttempt.user_id == user_id, UserAttempt.treasure_id == treasure_id)
            )
        )
        return result.scalar_one_or_none()


async def update_attempt(user_id: int, treasure_id: int, **kwargs) -> None:
    async with SessionLocal() as session:
        result = await session.execute(
            select(UserAttempt).where(
                and_(UserAttempt.user_id == user_id, UserAttempt.treasure_id == treasure_id)
            )
        )
        attempt = result.scalar_one_or_none()
        if attempt:
            for key, value in kwargs.items():
                setattr(attempt, key, value)
            await session.commit()


# ── UserGP ────────────────────────────────────────────────────────────────────

async def get_gp(user_id: int, username: Optional[str] = None) -> UserGP:
    async with SessionLocal() as session:
        result = await session.execute(select(UserGP).where(UserGP.user_id == user_id))
        gp = result.scalar_one_or_none()
        if not gp:
            gp = UserGP(user_id=user_id, username=username, balance=STARTING_GP)
            session.add(gp)
            await session.commit()
            await session.refresh(gp)
        return gp


async def deduct_gp(user_id: int, amount: int) -> bool:
    """Deduct GP from user balance. Returns True on success, False if insufficient."""
    async with SessionLocal() as session:
        result = await session.execute(select(UserGP).where(UserGP.user_id == user_id))
        gp = result.scalar_one_or_none()
        if not gp or gp.balance < amount:
            return False
        gp.balance -= amount
        await session.commit()
        return True


# ── HintPurchase ──────────────────────────────────────────────────────────────

async def get_purchased_hints(user_id: int, question_id: int) -> set[int]:
    """Return set of hint levels (1,2,3) already purchased for this question."""
    async with SessionLocal() as session:
        result = await session.execute(
            select(HintPurchase.hint_level).where(
                and_(HintPurchase.user_id == user_id, HintPurchase.question_id == question_id)
            )
        )
        return set(result.scalars().all())


async def record_hint_purchase(user_id: int, question_id: int, level: int, cost: int) -> None:
    async with SessionLocal() as session:
        hp = HintPurchase(user_id=user_id, question_id=question_id, hint_level=level, gp_cost=cost)
        session.add(hp)
        await session.commit()
