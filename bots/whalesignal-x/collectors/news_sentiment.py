"""News sentiment analysis and Hidden Gem detection."""
import logging
import xml.etree.ElementTree as ET
from collectors.base import BaseCollector, Opportunity
from services.whale_score import quick_score
from services.ai_service import analyze_news_sentiment, analyze_hidden_gems
from config import RSS_FEEDS, COINGECKO_BASE, COINGECKO_API_KEY

logger = logging.getLogger(__name__)

POSITIVE_SIGNALS = [
    "bullish", "surge", "rally", "all-time high", "ath", "mainstream adoption",
    "partnership", "integration", "launch", "milestone", "record"
]
NEGATIVE_SIGNALS = [
    "hack", "exploit", "rug pull", "crash", "bear", "sec charges", "ban",
    "collapse", "fraud", "lawsuit", "fud"
]


def _simple_sentiment(text: str) -> tuple[str, int]:
    text_lower = text.lower()
    pos = sum(1 for k in POSITIVE_SIGNALS if k in text_lower)
    neg = sum(1 for k in NEGATIVE_SIGNALS if k in text_lower)
    if pos > neg:
        return "positive", min(60 + pos * 5, 90)
    elif neg > pos:
        return "negative", max(40 - neg * 5, 10)
    return "neutral", 50


class NewsSentimentCollector(BaseCollector):
    category = "news"

    async def collect(self) -> list[Opportunity]:
        all_items = []
        for feed_url in RSS_FEEDS:
            try:
                text = await self._get_text(feed_url)
                if not text:
                    continue
                root = ET.fromstring(text)
                for item in root.findall(".//item")[:20]:
                    title = (item.findtext("title") or "").strip()
                    desc = (item.findtext("description") or "").strip()
                    link = (item.findtext("link") or "").strip()
                    all_items.append({"title": title, "desc": desc, "url": link})
            except Exception as e:
                logger.error(f"News RSS error {feed_url}: {e}")

        if not all_items:
            return []

        sentiment_result = await analyze_news_sentiment(all_items)
        sentiment = sentiment_result.get("sentiment", "neutral")
        score_val = sentiment_result.get("score", 50)
        summary = sentiment_result.get("summary", "")

        sentiment_score = quick_score(50 + int((score_val - 50) * 0.3), [])

        return [
            Opportunity(
                category="news",
                title=f"Market Sentiment: {sentiment.upper()} (Score: {score_val}/100)",
                summary=summary,
                source_url="https://cointelegraph.com",
                whale_score=sentiment_score,
                raw_data={
                    "sentiment": sentiment,
                    "score": score_val,
                    "summary": summary,
                    "top_positive": sentiment_result.get("top_positive", []),
                    "top_negative": sentiment_result.get("top_negative", []),
                    "whale_score": sentiment_score,
                },
            )
        ]


class HiddenGemCollector(BaseCollector):
    category = "hidden"

    async def collect(self) -> list[Opportunity]:
        candidate_projects = await self._get_emerging_projects()
        if not candidate_projects:
            return []

        gems = await analyze_hidden_gems(candidate_projects)
        opps = []
        for gem in gems:
            score = gem.get("whale_score", 75)
            opps.append(Opportunity(
                category="hidden",
                title=f"Hidden Gem: {gem.get('project', 'Unknown')} — {gem.get('category', 'N/A')}",
                summary=gem.get("key_reason", "AI-detected hidden opportunity"),
                source_url=f"https://www.coingecko.com",
                whale_score=score,
                raw_data={
                    "project": gem.get("project", "Unknown"),
                    "visibility": gem.get("visibility", "Low"),
                    "potential": gem.get("potential", "High"),
                    "category": gem.get("category", "N/A"),
                    "url": "https://www.coingecko.com",
                    "whale_score": score,
                },
            ))
        return opps

    async def _get_emerging_projects(self) -> list:
        headers = {}
        if COINGECKO_API_KEY:
            headers["x-cg-demo-api-key"] = COINGECKO_API_KEY

        trending = await self._get(f"{COINGECKO_BASE}/search/trending", headers=headers)
        projects = []
        if trending and "coins" in trending:
            for item in trending["coins"][:10]:
                coin = item.get("item", {})
                projects.append({
                    "name": coin.get("name", ""),
                    "symbol": coin.get("symbol", ""),
                    "market_cap_rank": coin.get("market_cap_rank", 9999),
                    "score": coin.get("score", 0),
                })

        new_coins = await self._get(f"{COINGECKO_BASE}/coins/list/new", headers=headers)
        if isinstance(new_coins, list):
            for coin in new_coins[:10]:
                projects.append({
                    "name": coin.get("name", ""),
                    "symbol": coin.get("symbol", ""),
                    "market_cap_rank": 9999,
                    "score": 0,
                    "new": True,
                })
        return projects
