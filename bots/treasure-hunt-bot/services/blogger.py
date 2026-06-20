"""Google Blogger API integration — post articles alongside Telegram broadcasts."""
from __future__ import annotations

import logging
import re

import aiohttp

from config import BLOGGER_BLOG_ID, BLOGGER_CLIENT_ID, BLOGGER_CLIENT_SECRET, BLOGGER_REFRESH_TOKEN

logger = logging.getLogger(__name__)

TOKEN_URL = "https://oauth2.googleapis.com/token"


def _md_to_html(text: str) -> str:
    text = re.sub(r"\*\*?([^*\n]+)\*\*?", r"<strong>\1</strong>", text)
    text = re.sub(r"_([^_\n]+)_", r"<em>\1</em>", text)
    text = re.sub(r"`([^`\n]+)`", r"<code>\1</code>", text)
    paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
    return "".join(f"<p>{p}</p>" for p in paragraphs)


async def _get_access_token() -> str | None:
    if not all([BLOGGER_CLIENT_ID, BLOGGER_CLIENT_SECRET, BLOGGER_REFRESH_TOKEN]):
        logger.warning("Blogger credentials not configured — skipping")
        return None
    async with aiohttp.ClientSession() as session:
        async with session.post(TOKEN_URL, data={
            "client_id": BLOGGER_CLIENT_ID,
            "client_secret": BLOGGER_CLIENT_SECRET,
            "refresh_token": BLOGGER_REFRESH_TOKEN,
            "grant_type": "refresh_token",
        }) as resp:
            if resp.status != 200:
                logger.error("Blogger token refresh failed (%s): %s", resp.status, await resp.text())
                return None
            data = await resp.json()
            return data.get("access_token")


async def post_blogger(title: str, content: str, *, is_html: bool = False) -> bool:
    """Post to Google Blogger. content is Telegram Markdown unless is_html=True."""
    if not BLOGGER_BLOG_ID:
        logger.warning("BLOGGER_BLOG_ID not set — skipping Blogger post")
        return False

    access_token = await _get_access_token()
    if not access_token:
        return False

    html_body = content if is_html else _md_to_html(content)
    url = f"https://www.googleapis.com/blogger/v3/blogs/{BLOGGER_BLOG_ID}/posts/"

    async with aiohttp.ClientSession() as session:
        async with session.post(
            url,
            headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
            json={"kind": "blogger#post", "title": title, "content": html_body},
        ) as resp:
            if resp.status == 200:
                logger.info("Blogger post published: %s", title)
                return True
            logger.error("Blogger post failed (%s): %s", resp.status, await resp.text())
            return False
