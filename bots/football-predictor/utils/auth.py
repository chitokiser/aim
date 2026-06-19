"""Generate bot-login JWT tokens for Telegram auto-login to ai119.netlify.app."""
from __future__ import annotations

import time

from config import JWT_SECRET, SITE_URL


def create_bot_login_url(telegram_id: int, first_name: str = "", username: str = "") -> str | None:
    """Return SITE_URL?tg=<jwt> or None if JWT_SECRET is not configured."""
    if not JWT_SECRET:
        return None

    try:
        import jwt
    except ImportError:
        return None

    payload = {
        "telegramId": str(telegram_id),
        "type": "bot-login",
        "firstName": first_name or None,
        "username": username or None,
        "iat": int(time.time()),
        "exp": int(time.time()) + 3600,  # 1 hour
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    return f"{SITE_URL}?tg={token}"
