"""JWT helper — creates ?tg=<token> auto-login URLs for the AI119 platform."""

import time
import jwt
from config import JWT_SECRET, PARTNER_PLATFORM_URL


def create_login_url(
    user_id: int,
    first_name: str = "",
    last_name: str = "",
    username: str = "",
) -> str:
    """Return PARTNER_PLATFORM_URL?tg=<signed-jwt> so the frontend auto-logs the user in."""
    now = int(time.time())
    payload = {
        "telegramId": str(user_id),
        "type": "bot-login",
        "firstName": first_name or None,
        "lastName": last_name or None,
        "username": username or None,
        "iat": now,
        "exp": now + 3600,
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    base = PARTNER_PLATFORM_URL.rstrip("/")
    return f"{base}?tg={token}"
