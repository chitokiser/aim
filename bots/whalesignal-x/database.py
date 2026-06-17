import asyncio
import json
import sqlite3
from datetime import datetime, timedelta
from typing import Optional
from config import DATABASE_URL

_is_postgres = DATABASE_URL.startswith("postgresql") or DATABASE_URL.startswith("postgres")


def _get_sqlite_path() -> str:
    url = DATABASE_URL.replace("sqlite+aiosqlite:///", "").replace("sqlite:///", "")
    return url


class Database:
    def __init__(self):
        self._conn: Optional[sqlite3.Connection] = None
        self._pg_pool = None

    async def connect(self):
        if _is_postgres:
            import asyncpg
            dsn = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
            self._pg_pool = await asyncpg.create_pool(dsn)
        else:
            self._conn = sqlite3.connect(_get_sqlite_path(), check_same_thread=False)
            self._conn.row_factory = sqlite3.Row
        await self._init_tables()

    async def disconnect(self):
        if self._pg_pool:
            await self._pg_pool.close()
        if self._conn:
            self._conn.close()

    async def _execute(self, sql: str, params=()) -> list:
        if _is_postgres:
            async with self._pg_pool.acquire() as conn:
                sql_pg = sql.replace("?", "$" + "1")
                for i in range(2, sql.count("?") + 1):
                    sql_pg = sql_pg.replace("$1", f"${i}", 1)
                rows = await conn.fetch(sql_pg, *params)
                return [dict(r) for r in rows]
        else:
            loop = asyncio.get_event_loop()
            def _run():
                cur = self._conn.cursor()
                cur.execute(sql, params)
                self._conn.commit()
                try:
                    return [dict(r) for r in cur.fetchall()]
                except Exception:
                    return []
            return await loop.run_in_executor(None, _run)

    async def _init_tables(self):
        ddl = """
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY,
            username TEXT,
            full_name TEXT,
            subscription TEXT DEFAULT 'free',
            sub_expires_at TEXT,
            daily_queries INTEGER DEFAULT 0,
            last_query_date TEXT,
            notify_funding INTEGER DEFAULT 1,
            notify_grants INTEGER DEFAULT 1,
            notify_airdrop INTEGER DEFAULT 1,
            notify_listings INTEGER DEFAULT 1,
            min_whale_score INTEGER DEFAULT 60,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS opportunities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            title TEXT NOT NULL,
            summary TEXT,
            source_url TEXT,
            whale_score INTEGER DEFAULT 0,
            raw_data TEXT,
            is_sent INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS alerts_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            opportunity_id INTEGER,
            sent_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            plan TEXT,
            started_at TEXT,
            expires_at TEXT,
            payment_ref TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        """
        for stmt in ddl.strip().split(";"):
            stmt = stmt.strip()
            if stmt:
                await self._execute(stmt)

    async def upsert_user(self, user_id: int, username: str, full_name: str):
        await self._execute(
            "INSERT OR IGNORE INTO users (user_id, username, full_name) VALUES (?, ?, ?)",
            (user_id, username or "", full_name or ""),
        )
        await self._execute(
            "UPDATE users SET username=?, full_name=? WHERE user_id=?",
            (username or "", full_name or "", user_id),
        )

    async def get_user(self, user_id: int) -> Optional[dict]:
        rows = await self._execute("SELECT * FROM users WHERE user_id=?", (user_id,))
        return rows[0] if rows else None

    async def check_and_increment_query(self, user_id: int) -> bool:
        user = await self.get_user(user_id)
        if not user:
            return False
        today = datetime.utcnow().strftime("%Y-%m-%d")
        if user["last_query_date"] != today:
            await self._execute(
                "UPDATE users SET daily_queries=1, last_query_date=? WHERE user_id=?",
                (today, user_id),
            )
            return True
        plan = user.get("subscription", "free")
        if plan in ("pro", "vip"):
            await self._execute(
                "UPDATE users SET daily_queries=daily_queries+1 WHERE user_id=?",
                (user_id,),
            )
            return True
        from config import FREE_DAILY_LIMIT
        if user["daily_queries"] < FREE_DAILY_LIMIT:
            await self._execute(
                "UPDATE users SET daily_queries=daily_queries+1 WHERE user_id=?",
                (user_id,),
            )
            return True
        return False

    async def save_opportunity(self, category: str, title: str, summary: str,
                                source_url: str, whale_score: int, raw_data: dict) -> int:
        await self._execute(
            """INSERT INTO opportunities (category, title, summary, source_url, whale_score, raw_data)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (category, title, summary, source_url, whale_score, json.dumps(raw_data)),
        )
        rows = await self._execute("SELECT last_insert_rowid() as id")
        return rows[0]["id"] if rows else 0

    async def get_opportunities(self, category: str = None, limit: int = 10,
                                 min_score: int = 0) -> list:
        if category:
            return await self._execute(
                """SELECT * FROM opportunities WHERE category=? AND whale_score>=?
                   ORDER BY whale_score DESC, created_at DESC LIMIT ?""",
                (category, min_score, limit),
            )
        return await self._execute(
            """SELECT * FROM opportunities WHERE whale_score>=?
               ORDER BY whale_score DESC, created_at DESC LIMIT ?""",
            (min_score, limit),
        )

    async def get_top_opportunities(self, limit: int = 5) -> list:
        return await self._execute(
            """SELECT * FROM opportunities WHERE whale_score>=75
               ORDER BY whale_score DESC, created_at DESC LIMIT ?""",
            (limit,),
        )

    async def get_unsent_opportunities(self) -> list:
        return await self._execute(
            "SELECT * FROM opportunities WHERE is_sent=0 AND whale_score>=70 ORDER BY whale_score DESC",
        )

    async def mark_sent(self, opp_id: int):
        await self._execute("UPDATE opportunities SET is_sent=1 WHERE id=?", (opp_id,))

    async def log_alert(self, user_id: int, opp_id: int):
        await self._execute(
            "INSERT INTO alerts_log (user_id, opportunity_id) VALUES (?, ?)",
            (user_id, opp_id),
        )

    async def set_subscription(self, user_id: int, plan: str, days: int, payment_ref: str = ""):
        expires = (datetime.utcnow() + timedelta(days=days)).isoformat()
        await self._execute(
            "UPDATE users SET subscription=?, sub_expires_at=? WHERE user_id=?",
            (plan, expires, user_id),
        )
        await self._execute(
            "INSERT INTO subscriptions (user_id, plan, started_at, expires_at, payment_ref) VALUES (?, ?, ?, ?, ?)",
            (user_id, plan, datetime.utcnow().isoformat(), expires, payment_ref),
        )

    async def get_all_users(self) -> list:
        return await self._execute("SELECT * FROM users")

    async def get_pro_users(self) -> list:
        return await self._execute(
            "SELECT * FROM users WHERE subscription IN ('pro', 'vip')"
        )

    async def get_stats(self) -> dict:
        total = await self._execute("SELECT COUNT(*) as c FROM users")
        pro = await self._execute("SELECT COUNT(*) as c FROM users WHERE subscription='pro'")
        vip = await self._execute("SELECT COUNT(*) as c FROM users WHERE subscription='vip'")
        opps = await self._execute("SELECT COUNT(*) as c FROM opportunities")
        return {
            "total_users": total[0]["c"] if total else 0,
            "pro_users": pro[0]["c"] if pro else 0,
            "vip_users": vip[0]["c"] if vip else 0,
            "total_opportunities": opps[0]["c"] if opps else 0,
        }


db = Database()
