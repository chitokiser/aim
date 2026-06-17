from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import BigInteger, String, Boolean, DateTime, Text, Integer, func
from datetime import datetime
from config import DATABASE_URL

engine = create_async_engine(DATABASE_URL, echo=False)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


class Subscriber(Base):
    __tablename__ = "subscribers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    chat_id: Mapped[int] = mapped_column(BigInteger, unique=True, nullable=False)
    username: Mapped[str | None] = mapped_column(String(128))
    first_name: Mapped[str | None] = mapped_column(String(128))
    is_group: Mapped[bool] = mapped_column(Boolean, default=False)
    subscribed: Mapped[bool] = mapped_column(Boolean, default=True)
    alert_threshold: Mapped[float] = mapped_column(default=5.0)  # % for spike alerts
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class BroadcastLog(Base):
    __tablename__ = "broadcast_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    broadcast_type: Mapped[str] = mapped_column(String(32))  # "morning" | "evening" | "alert" | "admin"
    content: Mapped[str] = mapped_column(Text)
    sent_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncSession:
    async with SessionLocal() as session:
        yield session


async def upsert_subscriber(chat_id: int, username: str | None, first_name: str | None, is_group: bool = False):
    async with SessionLocal() as session:
        from sqlalchemy import select
        result = await session.execute(select(Subscriber).where(Subscriber.chat_id == chat_id))
        sub = result.scalar_one_or_none()
        if sub:
            sub.subscribed = True
            sub.username = username
            sub.first_name = first_name
        else:
            sub = Subscriber(chat_id=chat_id, username=username, first_name=first_name, is_group=is_group)
            session.add(sub)
        await session.commit()


async def set_subscribed(chat_id: int, value: bool):
    async with SessionLocal() as session:
        from sqlalchemy import select
        result = await session.execute(select(Subscriber).where(Subscriber.chat_id == chat_id))
        sub = result.scalar_one_or_none()
        if sub:
            sub.subscribed = value
            await session.commit()


async def get_active_subscribers() -> list[Subscriber]:
    async with SessionLocal() as session:
        from sqlalchemy import select
        result = await session.execute(select(Subscriber).where(Subscriber.subscribed == True))
        return result.scalars().all()


async def get_subscriber(chat_id: int) -> Subscriber | None:
    async with SessionLocal() as session:
        from sqlalchemy import select
        result = await session.execute(select(Subscriber).where(Subscriber.chat_id == chat_id))
        return result.scalar_one_or_none()


async def log_broadcast(broadcast_type: str, content: str, sent_count: int):
    async with SessionLocal() as session:
        log = BroadcastLog(broadcast_type=broadcast_type, content=content, sent_count=sent_count)
        session.add(log)
        await session.commit()


async def get_stats() -> dict:
    async with SessionLocal() as session:
        from sqlalchemy import select, func as sqlfunc
        total = await session.execute(select(sqlfunc.count()).select_from(Subscriber))
        active = await session.execute(
            select(sqlfunc.count()).select_from(Subscriber).where(Subscriber.subscribed == True)
        )
        groups = await session.execute(
            select(sqlfunc.count()).select_from(Subscriber).where(Subscriber.is_group == True)
        )
        return {
            "total": total.scalar(),
            "active": active.scalar(),
            "groups": groups.scalar(),
        }
