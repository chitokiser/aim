import asyncio
import logging
from dataclasses import dataclass, field
from typing import Optional
import aiohttp

logger = logging.getLogger(__name__)


@dataclass
class Opportunity:
    category: str
    title: str
    summary: str
    source_url: str
    whale_score: int
    raw_data: dict = field(default_factory=dict)


class BaseCollector:
    category = "base"
    timeout = aiohttp.ClientTimeout(total=15)

    async def collect(self) -> list[Opportunity]:
        raise NotImplementedError

    async def _get(self, url: str, headers: dict = None, params: dict = None) -> Optional[dict]:
        try:
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                async with session.get(url, headers=headers or {}, params=params or {}) as resp:
                    if resp.status == 200:
                        ct = resp.headers.get("Content-Type", "")
                        if "json" in ct:
                            return await resp.json()
                        return {"text": await resp.text()}
                    logger.warning(f"{self.category}: HTTP {resp.status} from {url}")
                    return None
        except Exception as e:
            logger.error(f"{self.category}: fetch error {url}: {e}")
            return None

    async def _get_text(self, url: str, headers: dict = None) -> Optional[str]:
        try:
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                async with session.get(url, headers=headers or {}) as resp:
                    if resp.status == 200:
                        return await resp.text()
                    return None
        except Exception as e:
            logger.error(f"{self.category}: text fetch error {url}: {e}")
            return None
