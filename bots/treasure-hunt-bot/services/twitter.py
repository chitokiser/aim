"""X (Twitter) API v2 integration — post tweets alongside Telegram broadcasts."""
from __future__ import annotations

import asyncio
import logging
import re

from config import (
    TWITTER_ACCESS_TOKEN,
    TWITTER_ACCESS_TOKEN_SECRET,
    TWITTER_API_KEY,
    TWITTER_API_SECRET,
)

logger = logging.getLogger(__name__)

_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client
    if not all([TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET]):
        return None
    try:
        import tweepy
        _client = tweepy.Client(
            consumer_key=TWITTER_API_KEY,
            consumer_secret=TWITTER_API_SECRET,
            access_token=TWITTER_ACCESS_TOKEN,
            access_token_secret=TWITTER_ACCESS_TOKEN_SECRET,
        )
        logger.info("Twitter client initialized")
    except ImportError:
        logger.warning("tweepy not installed — Twitter posting disabled")
    return _client


def _clean(text: str, max_len: int = 280) -> str:
    """Strip Telegram Markdown and truncate to X character limit."""
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    text = re.sub(r"_([^_]+)_", r"\1", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = text.strip()
    if len(text) > max_len:
        text = text[: max_len - 1] + "…"
    return text


async def post_tweet(text: str) -> bool:
    """Post text to X. Returns True on success, False if disabled or failed."""
    client = _get_client()
    if not client:
        return False

    clean_text = _clean(text)
    try:
        await asyncio.to_thread(client.create_tweet, text=clean_text)
        logger.info("Tweet posted (%d chars)", len(clean_text))
        return True
    except Exception as exc:
        logger.error("Twitter post failed: %s", exc)
        return False
