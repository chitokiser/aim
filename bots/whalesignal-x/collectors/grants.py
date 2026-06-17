"""Grants, Hackathons, Bug Bounties, and Accelerators collector."""
import xml.etree.ElementTree as ET
import logging
import re
from datetime import datetime, timedelta
from collectors.base import BaseCollector, Opportunity
from services.whale_score import quick_score
from config import RSS_FEEDS

logger = logging.getLogger(__name__)

GRANT_KEYWORDS = ["grant", "rfp", "ecosystem fund", "developer fund", "gitcoin", "rpgf"]
HACKATHON_KEYWORDS = ["hackathon", "buildathon", "buidl", "eth global", "dorahacks", "devpost", "encode"]
BOUNTY_KEYWORDS = ["bug bounty", "vulnerability", "reward program", "immunefi", "hackerone"]
ACCEL_KEYWORDS = ["accelerator", "incubator", "cohort", "batch", "y combinator", "alliance dao", "techstars"]

DORAHACKS_HACKATHONS = [
    {
        "name": "DoraHacks Web3 Hackathon",
        "prize": "$100,000+",
        "status": "OPEN",
        "deadline": (datetime.utcnow() + timedelta(days=30)).strftime("%Y-%m-%d"),
        "organizer": "DoraHacks",
        "url": "https://dorahacks.io/hackathon",
    },
]

KNOWN_GRANTS = [
    {
        "network": "Arbitrum",
        "budget": "Up to $100,000",
        "target": "DeFi / Infrastructure",
        "deadline": "Rolling",
        "url": "https://arbitrum.foundation/grants",
    },
    {
        "network": "Base",
        "budget": "Up to $250,000",
        "target": "AI Agents / DeFi",
        "deadline": "Rolling",
        "url": "https://base.org/grants",
    },
    {
        "network": "Optimism RPGF",
        "budget": "$10M+ pool",
        "target": "Public Goods",
        "deadline": "Rolling",
        "url": "https://app.optimism.io/retropgf",
    },
    {
        "network": "Solana Foundation",
        "budget": "Up to $100,000",
        "target": "Infrastructure / DApp",
        "deadline": "Rolling",
        "url": "https://solana.org/grants",
    },
]


def _detect_type(title: str, desc: str) -> str:
    combined = (title + " " + desc).lower()
    if any(k in combined for k in HACKATHON_KEYWORDS):
        return "hackathon"
    if any(k in combined for k in BOUNTY_KEYWORDS):
        return "bug_bounty"
    if any(k in combined for k in ACCEL_KEYWORDS):
        return "accelerator"
    if any(k in combined for k in GRANT_KEYWORDS):
        return "grant"
    return None


class GrantsCollector(BaseCollector):
    category = "grants"

    async def collect(self) -> list[Opportunity]:
        results = []
        results.extend(self._known_grants())
        results.extend(self._known_hackathons())
        results.extend(await self._collect_from_rss())
        return results

    def _known_grants(self) -> list[Opportunity]:
        opps = []
        for g in KNOWN_GRANTS:
            score = quick_score(75, [10])
            opps.append(Opportunity(
                category="grant",
                title=f"Grant: {g['network']} — {g['budget']}",
                summary=f"Target: {g['target']}, Deadline: {g['deadline']}",
                source_url=g["url"],
                whale_score=score,
                raw_data={**g, "whale_score": score},
            ))
        return opps

    def _known_hackathons(self) -> list[Opportunity]:
        opps = []
        for h in DORAHACKS_HACKATHONS:
            score = quick_score(70, [10])
            opps.append(Opportunity(
                category="hackathon",
                title=f"Hackathon: {h['name']} — Prize {h['prize']}",
                summary=f"Registration: {h['status']}, Deadline: {h['deadline']}",
                source_url=h["url"],
                whale_score=score,
                raw_data={**h, "whale_score": score},
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
                    kind = _detect_type(title, desc)
                    if not kind:
                        continue
                    score = quick_score(65, [10 if "million" in desc.lower() else 0])
                    opps.append(Opportunity(
                        category=kind,
                        title=title[:200],
                        summary=desc[:400],
                        source_url=link,
                        whale_score=score,
                        raw_data={
                            "name": title[:100],
                            "prize": "N/A",
                            "status": "OPEN",
                            "deadline": "Check source",
                            "organizer": "See link",
                            "url": link,
                            "whale_score": score,
                            "network": "Various",
                            "budget": "N/A",
                            "target": "Developers",
                        },
                    ))
            except Exception as e:
                logger.error(f"Grants RSS error: {e}")
        return opps
