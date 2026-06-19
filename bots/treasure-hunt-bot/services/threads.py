"""Meta Threads API integration — post to Threads alongside Telegram broadcasts."""
from __future__ import annotations

import asyncio
import logging
import re

import aiohttp

from config import THREADS_USER_ID, THREADS_ACCESS_TOKEN

logger = logging.getLogger(__name__)

THREADS_BASE = "https://graph.threads.net/v1.0"


def _clean(text: str, max_len: int = 500) -> str:
    """Strip Telegram Markdown and truncate to Threads character limit."""
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    text = re.sub(r"_([^_]+)_", r"\1", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = text.strip()
    if len(text) > max_len:
        text = text[: max_len - 1] + "…"
    return text


async def post_threads(text: str) -> bool:
    """Post text to Threads. Returns True on success, False if disabled or failed."""
    if not THREADS_USER_ID or not THREADS_ACCESS_TOKEN:
        logger.debug("Threads credentials not set — skipping post")
        return False

    clean_text = _clean(text)

    try:
        async with aiohttp.ClientSession() as session:
            # Step 1: Create media container
            create_url = f"{THREADS_BASE}/{THREADS_USER_ID}/threads"
            async with session.post(
                create_url,
                params={
                    "media_type": "TEXT",
                    "text": clean_text,
                    "access_token": THREADS_ACCESS_TOKEN,
                },
                timeout=aiohttp.ClientTimeout(total=20),
            ) as resp:
                if resp.status != 200:
                    body = await resp.text()
                    logger.error("Threads create container failed %d: %s", resp.status, body[:300])
                    return False
                data = await resp.json()
                container_id = data.get("id")

            if not container_id:
                logger.error("Threads create container returned no id")
                return False

            # Brief delay recommended by Meta before publishing
            await asyncio.sleep(2)

            # Step 2: Publish the container
            publish_url = f"{THREADS_BASE}/{THREADS_USER_ID}/threads_publish"
            async with session.post(
                publish_url,
                params={
                    "creation_id": container_id,
                    "access_token": THREADS_ACCESS_TOKEN,
                },
                timeout=aiohttp.ClientTimeout(total=20),
            ) as resp:
                if resp.status != 200:
                    body = await resp.text()
                    logger.error("Threads publish failed %d: %s", resp.status, body[:300])
                    return False
                result = await resp.json()
                post_id = result.get("id", "?")
                logger.info("Threads post published (id=%s, %d chars)", post_id, len(clean_text))
                return True

    except Exception as exc:
        logger.error("Threads post failed: %s", exc)
        return False
