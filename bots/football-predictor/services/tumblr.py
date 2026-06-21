"""Tumblr API integration — post alongside Telegram broadcasts."""
from __future__ import annotations

import asyncio
import logging
import re

from config import (
    TUMBLR_CONSUMER_KEY,
    TUMBLR_CONSUMER_SECRET,
    TUMBLR_OAUTH_TOKEN,
    TUMBLR_OAUTH_SECRET,
    TUMBLR_BLOG_NAME,
)

logger = logging.getLogger(__name__)

_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client
    if not all([TUMBLR_CONSUMER_KEY, TUMBLR_CONSUMER_SECRET, TUMBLR_OAUTH_TOKEN, TUMBLR_OAUTH_SECRET]):
        return None
    try:
        import pytumblr
        _client = pytumblr.TumblrRestClient(
            TUMBLR_CONSUMER_KEY,
            TUMBLR_CONSUMER_SECRET,
            TUMBLR_OAUTH_TOKEN,
            TUMBLR_OAUTH_SECRET,
        )
        logger.info("Tumblr client initialized")
    except ImportError:
        logger.warning("pytumblr not installed — Tumblr posting disabled")
    return _client


def _clean(text: str) -> str:
    text = re.sub(r"\*\*?([^*\n]+)\*\*?", r"\1", text)
    text = re.sub(r"_([^_\n]+)_", r"\1", text)
    text = re.sub(r"`([^`\n]+)`", r"\1", text)
    return text.strip()


def _to_html(text: str) -> str:
    paragraphs = [p.strip() for p in _clean(text).split("\n") if p.strip()]
    return "".join(f"<p>{p}</p>" for p in paragraphs)


def _create_post(title: str, body_html: str) -> dict:
    client = _get_client()
    if not client or not TUMBLR_BLOG_NAME:
        return {"error": "not configured"}
    return client.create_text(TUMBLR_BLOG_NAME, title=title, body=body_html)


async def post_tumblr(title: str, content: str) -> bool:
    """Post a text post to Tumblr. Returns True on success, False if disabled or failed."""
    client = _get_client()
    if not client:
        logger.debug("Tumblr credentials not set — skipping post")
        return False
    if not TUMBLR_BLOG_NAME:
        logger.warning("TUMBLR_BLOG_NAME not set — skipping Tumblr post")
        return False

    body_html = _to_html(content)
    try:
        result = await asyncio.to_thread(_create_post, title, body_html)
        if isinstance(result, dict) and result.get("id"):
            logger.info("Tumblr post published (id=%s): %s", result["id"], title)
            return True
        logger.error("Tumblr post failed: %s", result)
        return False
    except Exception as exc:
        logger.error("Tumblr post error: %s", exc)
        return False
