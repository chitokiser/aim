"""Funding & investment detection collector."""
import re
import logging
import xml.etree.ElementTree as ET
from collectors.base import BaseCollector, Opportunity
from services.whale_score import calculate_whale_score, score_vc_quality
from config import RSS_FEEDS, CRYPTORANK_API_KEY, CRYPTORANK_BASE

logger = logging.getLogger(__name__)

FUNDING_KEYWORDS = [
    "raises", "funding", "raised", "investment", "seed round", "series a",
    "series b", "series c", "angel round", "private round", "strategic round",
    "venture", "million", "$m", "fundraise",
]

STAGE_PATTERNS = {
    "Series C": r"series\s*c",
    "Series B": r"series\s*b",
    "Series A": r"series\s*a",
    "Strategic": r"strategic",
    "Private": r"private\s*round",
    "Angel": r"angel",
    "Seed": r"seed",
}

AMOUNT_PATTERN = re.compile(r"\$(\d+(?:\.\d+)?)\s*(million|m|billion|b|k)", re.IGNORECASE)


def _extract_amount(text: str) -> float:
    match = AMOUNT_PATTERN.search(text)
    if not match:
        return 0.0
    amount = float(match.group(1))
    unit = match.group(2).lower()
    if unit in ("billion", "b"):
        return amount * 1_000_000_000
    elif unit in ("million", "m"):
        return amount * 1_000_000
    elif unit == "k":
        return amount * 1_000
    return amount


def _extract_stage(text: str) -> str:
    text_lower = text.lower()
    for stage, pattern in STAGE_PATTERNS.items():
        if re.search(pattern, text_lower):
            return stage
    return "Unknown"


def _is_funding_news(title: str, desc: str) -> bool:
    combined = (title + " " + desc).lower()
    return any(kw in combined for kw in FUNDING_KEYWORDS)


class FundingCollector(BaseCollector):
    category = "funding"

    async def collect(self) -> list[Opportunity]:
        results = []
        results.extend(await self._collect_from_rss())
        if CRYPTORANK_API_KEY:
            results.extend(await self._collect_from_cryptorank())
        return results

    async def _collect_from_rss(self) -> list[Opportunity]:
        opps = []
        for feed_url in RSS_FEEDS:
            try:
                text = await self._get_text(feed_url)
                if not text:
                    continue
                root = ET.fromstring(text)
                items = root.findall(".//item")
                for item in items[:20]:
                    title = (item.findtext("title") or "").strip()
                    desc = (item.findtext("description") or "").strip()
                    link = (item.findtext("link") or "").strip()
                    if not _is_funding_news(title, desc):
                        continue
                    amount = _extract_amount(title + " " + desc)
                    stage = _extract_stage(title + " " + desc)
                    score = calculate_whale_score({
                        "funding_usd": amount,
                        "has_partnership": False,
                    })
                    opps.append(Opportunity(
                        category="funding",
                        title=title[:200],
                        summary=desc[:500],
                        source_url=link,
                        whale_score=score,
                        raw_data={
                            "project": title.split("raises")[0].strip() if "raises" in title.lower() else title[:50],
                            "amount": f"${amount:,.0f}" if amount else "N/A",
                            "stage": stage,
                            "investor": "Various",
                            "category": "Crypto/Web3",
                            "url": link,
                            "whale_score": score,
                        },
                    ))
            except Exception as e:
                logger.error(f"RSS funding parse error {feed_url}: {e}")
        return opps

    async def _collect_from_cryptorank(self) -> list[Opportunity]:
        data = await self._get(
            f"{CRYPTORANK_BASE}/funding-rounds",
            headers={"X-Api-Key": CRYPTORANK_API_KEY},
            params={"limit": 20, "sortBy": "date", "order": "desc"},
        )
        if not data or "data" not in data:
            return []
        opps = []
        for item in data["data"]:
            amount = float(item.get("raisedAmount", 0) or 0)
            vc = item.get("leadInvestor", "Unknown")
            stage = item.get("type", "Unknown")
            score = calculate_whale_score({
                "funding_usd": amount,
                "vc_name": vc,
                "has_partnership": False,
            })
            project = item.get("projectName", "Unknown")
            url = item.get("projectUrl", f"https://cryptorank.io/funding-rounds")
            opps.append(Opportunity(
                category="funding",
                title=f"{project} raises ${amount:,.0f} — {stage}",
                summary=f"Lead: {vc}, Amount: ${amount:,.0f}, Stage: {stage}",
                source_url=url,
                whale_score=score,
                raw_data={
                    "project": project,
                    "amount": f"${amount:,.0f}",
                    "investor": vc,
                    "stage": stage,
                    "category": item.get("category", "N/A"),
                    "url": url,
                    "whale_score": score,
                },
            ))
        return opps
