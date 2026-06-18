from __future__ import annotations

from datetime import datetime, date

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Integer,
    String,
    func,
    select,
    text,
    update,
)
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from config import DATABASE_URL


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True, nullable=False, index=True)
    username: Mapped[str | None] = mapped_column(String(128))
    first_name: Mapped[str | None] = mapped_column(String(128))
    language: Mapped[str] = mapped_column(String(4), default="en")
    ap_balance: Mapped[int] = mapped_column(BigInteger, default=0)
    p_balance: Mapped[int] = mapped_column(BigInteger, default=0)
    total_predicted: Mapped[int] = mapped_column(Integer, default=0)
    correct_predictions: Mapped[int] = mapped_column(Integer, default=0)
    total_ap_won: Mapped[int] = mapped_column(BigInteger, default=0)
    win_streak: Mapped[int] = mapped_column(Integer, default=0)
    max_win_streak: Mapped[int] = mapped_column(Integer, default=0)
    streak_days: Mapped[int] = mapped_column(Integer, default=0)
    last_daily_date: Mapped[str | None] = mapped_column(String(16))  # YYYY-MM-DD
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    home_team: Mapped[str] = mapped_column(String(128))
    away_team: Mapped[str] = mapped_column(String(128))
    league: Mapped[str] = mapped_column(String(128))
    match_time: Mapped[datetime] = mapped_column(DateTime)  # UTC
    status: Mapped[str] = mapped_column(String(32), default="scheduled")
    # status: scheduled | live | finished | cancelled
    home_score: Mapped[int | None] = mapped_column(Integer)
    away_score: Mapped[int | None] = mapped_column(Integer)
    external_id: Mapped[int | None] = mapped_column(BigInteger)  # football-data.org ID
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    match_id: Mapped[int] = mapped_column(Integer, ForeignKey("matches.id"), nullable=False, index=True)
    pred_type: Mapped[str] = mapped_column(String(16))
    # pred_type: 1x2 | score | btts | ou | first | handicap
    pred_value: Mapped[str] = mapped_column(String(32))
    # pred_value: home|draw|away | 2-1 | yes|no | over|under | home|away | home|away
    stake_ap: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(16), default="pending")
    # status: pending | won | lost | cancelled
    stake_currency: Mapped[str] = mapped_column(String(4), default="ap")  # "ap" or "p"
    payout_ap: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


# ---------------------------------------------------------------------------
# Engine & session factory
# ---------------------------------------------------------------------------

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Add new columns to existing tables (safe: ignores error if column exists)
        for sql in (
            "ALTER TABLE users ADD COLUMN p_balance BIGINT DEFAULT 0",
            "ALTER TABLE predictions ADD COLUMN stake_currency VARCHAR(4) DEFAULT 'ap'",
        ):
            try:
                await conn.execute(text(sql))
            except Exception:
                pass


# ---------------------------------------------------------------------------
# User helpers
# ---------------------------------------------------------------------------

async def get_or_create_user(
    session: AsyncSession,
    telegram_id: int,
    username: str | None,
    first_name: str | None,
    language: str,
    welcome_p: int = 0,
) -> tuple[User, bool]:
    """Return (user, is_new). Awards welcome_p (free points) only when is_new=True."""
    result = await session.execute(select(User).where(User.telegram_id == telegram_id))
    user = result.scalar_one_or_none()
    if user:
        # Update display info
        user.username = username
        user.first_name = first_name
        await session.commit()
        return user, False

    user = User(
        telegram_id=telegram_id,
        username=username,
        first_name=first_name,
        language=language,
        p_balance=welcome_p,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user, True


async def get_user(session: AsyncSession, telegram_id: int) -> User | None:
    result = await session.execute(select(User).where(User.telegram_id == telegram_id))
    return result.scalar_one_or_none()


async def set_user_language(session: AsyncSession, telegram_id: int, lang: str) -> None:
    await session.execute(
        update(User).where(User.telegram_id == telegram_id).values(language=lang)
    )
    await session.commit()


async def claim_daily(
    session: AsyncSession, user: User, today: str, daily_p: int = 0
) -> bool:
    """Award daily P points. Returns True if claimed, False if already claimed today."""
    if user.last_daily_date == today:
        return False

    yesterday = _yesterday(today)
    new_streak = (user.streak_days + 1) if user.last_daily_date == yesterday else 1

    user.p_balance += daily_p
    user.streak_days = new_streak
    user.last_daily_date = today
    await session.commit()
    return True


def _yesterday(today_str: str) -> str:
    from datetime import timedelta
    d = date.fromisoformat(today_str)
    return (d - timedelta(days=1)).isoformat()


# ---------------------------------------------------------------------------
# Match helpers
# ---------------------------------------------------------------------------

async def get_upcoming_matches(session: AsyncSession, limit: int = 20) -> list[Match]:
    now = datetime.utcnow()
    result = await session.execute(
        select(Match)
        .where(Match.status == "scheduled", Match.match_time > now)
        .order_by(Match.match_time)
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_match(session: AsyncSession, match_id: int) -> Match | None:
    return await session.get(Match, match_id)


async def add_match(
    session: AsyncSession,
    home_team: str,
    away_team: str,
    league: str,
    match_time: datetime,
    external_id: int | None = None,
) -> Match:
    match = Match(
        home_team=home_team,
        away_team=away_team,
        league=league,
        match_time=match_time,
        external_id=external_id,
    )
    session.add(match)
    await session.commit()
    await session.refresh(match)
    return match


# ---------------------------------------------------------------------------
# Prediction helpers
# ---------------------------------------------------------------------------

async def has_predicted(session: AsyncSession, user_id: int, match_id: int) -> bool:
    result = await session.execute(
        select(Prediction).where(
            Prediction.user_id == user_id,
            Prediction.match_id == match_id,
            Prediction.status != "cancelled",
        )
    )
    return result.scalar_one_or_none() is not None


async def place_prediction(
    session: AsyncSession,
    user: User,
    match_id: int,
    pred_type: str,
    pred_value: str,
    stake_ap: int,
    payout_ap: int,
    currency: str = "ap",
) -> Prediction:
    pred = Prediction(
        user_id=user.id,
        match_id=match_id,
        pred_type=pred_type,
        pred_value=pred_value,
        stake_ap=stake_ap,
        payout_ap=payout_ap,
        stake_currency=currency,
    )
    if currency == "p":
        user.p_balance -= stake_ap
    else:
        user.ap_balance -= stake_ap
    user.total_predicted += 1
    session.add(pred)
    await session.commit()
    await session.refresh(pred)
    return pred


async def get_predictions_for_match(
    session: AsyncSession, match_id: int
) -> list[Prediction]:
    result = await session.execute(
        select(Prediction).where(
            Prediction.match_id == match_id,
            Prediction.status == "pending",
        )
    )
    return list(result.scalars().all())


async def settle_match(
    session: AsyncSession,
    match: Match,
    home_score: int,
    away_score: int,
) -> tuple[int, int]:
    """Settle all pending predictions for a match. Returns (winner_count, total_payout)."""
    predictions = await get_predictions_for_match(session, match.id)

    winners = 0
    total_payout = 0

    for pred in predictions:
        correct = _evaluate_prediction(pred.pred_type, pred.pred_value, home_score, away_score)
        if correct:
            pred.status = "won"
            payout = pred.payout_ap

            # Award winner in the same currency they bet with
            result = await session.execute(select(User).where(User.id == pred.user_id))
            winner = result.scalar_one_or_none()
            if winner:
                if pred.stake_currency == "p":
                    winner.p_balance += payout
                else:
                    winner.ap_balance += payout
                    winner.total_ap_won += payout
                winner.correct_predictions += 1
                winner.win_streak += 1
                if winner.win_streak > winner.max_win_streak:
                    winner.max_win_streak = winner.win_streak
            winners += 1
            total_payout += payout
        else:
            pred.status = "lost"
            # Reset win streak on loss
            result = await session.execute(select(User).where(User.id == pred.user_id))
            loser = result.scalar_one_or_none()
            if loser:
                loser.win_streak = 0

    match.status = "finished"
    match.home_score = home_score
    match.away_score = away_score
    await session.commit()
    return winners, total_payout


async def count_predictions_for_match(session: AsyncSession, match_id: int) -> int:
    result = await session.execute(
        select(func.count(Prediction.id)).where(
            Prediction.match_id == match_id,
            Prediction.status != "cancelled",
        )
    )
    return result.scalar() or 0


async def cancel_match_predictions(session: AsyncSession, match: Match) -> int:
    """Cancel all pending predictions and refund AP. Returns count refunded."""
    predictions = await get_predictions_for_match(session, match.id)
    count = 0
    for pred in predictions:
        result = await session.execute(select(User).where(User.id == pred.user_id))
        user = result.scalar_one_or_none()
        if user:
            if pred.stake_currency == "p":
                user.p_balance += pred.stake_ap
            else:
                user.ap_balance += pred.stake_ap
        pred.status = "cancelled"
        count += 1
    match.status = "cancelled"
    await session.commit()
    return count


def _evaluate_prediction(
    pred_type: str, pred_value: str, home_score: int, away_score: int
) -> bool:
    if pred_type == "1x2":
        if home_score > away_score:
            return pred_value == "home"
        if home_score == away_score:
            return pred_value == "draw"
        return pred_value == "away"

    if pred_type == "score":
        return pred_value == f"{home_score}-{away_score}"

    if pred_type == "btts":
        both = home_score > 0 and away_score > 0
        return (pred_value == "yes") == both

    if pred_type == "ou":
        total = home_score + away_score
        return (pred_value == "over") == (total > 2.5)

    if pred_type == "first":
        # Approximation: whoever has higher score most likely scored first.
        # Admin should manually settle "first" type if needed.
        if home_score > 0 and away_score == 0:
            return pred_value == "home"
        if away_score > 0 and home_score == 0:
            return pred_value == "away"
        # Both scored — default to home for tiebreak (admin should handle manually)
        return pred_value == "home"

    if pred_type == "handicap":
        # Home team -1: home wins by 2+ = home wins handicap
        diff = home_score - away_score
        if pred_value == "home":
            return diff >= 2
        return diff < 2

    return False


# ---------------------------------------------------------------------------
# Ranking helpers
# ---------------------------------------------------------------------------

async def get_leaderboard(
    session: AsyncSession, limit: int = 20
) -> list[User]:
    result = await session.execute(
        select(User)
        .where(User.total_predicted > 0)
        .order_by(User.correct_predictions.desc(), User.total_ap_won.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_user_rank(session: AsyncSession, user_id: int) -> int:
    result = await session.execute(
        select(func.count(User.id)).where(
            User.total_predicted > 0,
            User.correct_predictions
            > (
                select(User.correct_predictions).where(User.id == user_id).scalar_subquery()
            ),
        )
    )
    rank = result.scalar() or 0
    return rank + 1


# ---------------------------------------------------------------------------
# Broadcast helper
# ---------------------------------------------------------------------------

async def get_all_user_telegram_ids(session: AsyncSession) -> list[int]:
    result = await session.execute(select(User.telegram_id))
    return [row[0] for row in result.all()]
