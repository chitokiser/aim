"""Airdrop and Testnet opportunity collector."""
import logging
import xml.etree.ElementTree as ET
from collectors.base import BaseCollector, Opportunity
from services.whale_score import quick_score
from config import RSS_FEEDS

logger = logging.getLogger(__name__)

AIRDROP_KEYWORDS = ["airdrop", "token distribution", "claim", "galxe", "layer3", "zealy", "intract", "quest"]
TESTNET_KEYWORDS = ["testnet", "test net", "incentivized testnet", "public testnet", "beta mainnet"]

KNOWN_TESTNETS = [
    {
        "project": "EigenLayer AVS Testnet",
        "reward_prob": "High",
        "competition": "Medium",
        "status": "ACTIVE",
        "url": "https://docs.eigenlayer.xyz/eigenlayer/overview/",
        "whale_score": 85,
    },
    {
        "project": "Monad Testnet",
        "reward_prob": "Very High",
        "competition": "High",
        "status": "ACTIVE",
        "url": "https://monad.xyz",
        "whale_score": 88,
    },
    {
        "project": "MegaETH Testnet",
        "reward_prob": "High",
        "competition": "Medium",
        "status": "UPCOMING",
        "url": "https://megaeth.systems",
        "whale_score": 82,
    },
]

KNOWN_AIRDROPS = [
    {
        "project": "Scroll",
        "platform": "Layer3",
        "tasks": 3,
        "difficulty": "Easy",
        "reward": "$20~200",
        "url": "https://scroll.io/bridge",
        "whale_score": 78,
    },
    {
        "project": "zkSync Era",
        "platform": "Galxe",
        "tasks": 5,
        "difficulty": "Medium",
        "reward": "$50~500",
        "url": "https://zksync.io",
        "whale_score": 80,
    },
]


class AirdropCollector(BaseCollector):
    category = "airdrop"

    async def collect(self) -> list[Opportunity]:
        results = []
        results.extend(self._known_airdrops())
        results.extend(self._known_testnets())
        results.extend(await self._collect_from_rss())
        return results

    def _known_airdrops(self) -> list[Opportunity]:
        opps = []
        for a in KNOWN_AIRDROPS:
            opps.append(Opportunity(
                category="airdrop",
                title=f"Airdrop: {a['project']} — Reward {a['reward']}",
                summary=f"Platform: {a['platform']}, Tasks: {a['tasks']}, Difficulty: {a['difficulty']}",
                source_url=a["url"],
                whale_score=a["whale_score"],
                raw_data={**a},
            ))
        return opps

    def _known_testnets(self) -> list[Opportunity]:
        opps = []
        for t in KNOWN_TESTNETS:
            opps.append(Opportunity(
                category="testnet",
                title=f"Testnet: {t['project']} — Reward Prob: {t['reward_prob']}",
                summary=f"Competition: {t['competition']}, Status: {t['status']}",
                source_url=t["url"],
                whale_score=t["whale_score"],
                raw_data={**t},
            ))
        return opps

    async def _collect_from_rss(self) -> list[Opportunity]:
        opps = []
        for feed_url in RSS_FEEDS[:3]:
            try:
                text = await self._get_text(feed_url)
                if not text:
                    continue
                root = ET.fromstring(text)
                for item in root.findall(".//item")[:30]:
                    title = (item.findtext("title") or "").strip()
                    desc = (item.findtext("description") or "").strip()
                    link = (item.findtext("link") or "").strip()
                    combined = (title + " " + desc).lower()
                    if any(k in combined for k in AIRDROP_KEYWORDS):
                        score = quick_score(65, [10])
                        opps.append(Opportunity(
                            category="airdrop",
                            title=title[:200],
                            summary=desc[:400],
                            source_url=link,
                            whale_score=score,
                            raw_data={
                                "project": title[:60],
                                "platform": "Various",
                                "tasks": "Check source",
                                "difficulty": "Medium",
                                "reward": "N/A",
                                "url": link,
                                "whale_score": score,
                            },
                        ))
                    elif any(k in combined for k in TESTNET_KEYWORDS):
                        score = quick_score(65, [5])
                        opps.append(Opportunity(
                            category="testnet",
                            title=title[:200],
                            summary=desc[:400],
                            source_url=link,
                            whale_score=score,
                            raw_data={
                                "project": title[:60],
                                "reward_prob": "Medium",
                                "competition": "Medium",
                                "status": "ACTIVE",
                                "url": link,
                                "whale_score": score,
                            },
                        ))
            except Exception as e:
                logger.error(f"Airdrop RSS error: {e}")
        return opps
