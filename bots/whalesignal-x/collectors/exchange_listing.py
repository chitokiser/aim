"""Exchange listing detection and Smart Money on-chain tracker."""
import logging
import xml.etree.ElementTree as ET
from collectors.base import BaseCollector, Opportunity
from services.whale_score import quick_score
from config import COINGECKO_BASE, COINGECKO_API_KEY, RSS_FEEDS, DEFILLAMA_BASE

logger = logging.getLogger(__name__)

LISTING_KEYWORDS = ["listed on", "now available on", "trading begins", "spot trading", "futures listing"]
MAJOR_EXCHANGES = ["binance", "coinbase", "bybit", "okx", "upbit", "kraken", "gate.io", "kucoin"]


class ExchangeListingCollector(BaseCollector):
    category = "listings"

    async def collect(self) -> list[Opportunity]:
        results = []
        results.extend(await self._collect_new_listings_coingecko())
        results.extend(await self._collect_from_rss())
        return results

    async def _collect_new_listings_coingecko(self) -> list[Opportunity]:
        headers = {}
        if COINGECKO_API_KEY:
            headers["x-cg-demo-api-key"] = COINGECKO_API_KEY
        data = await self._get(
            f"{COINGECKO_BASE}/coins/list/new",
            headers=headers,
        )
        if not isinstance(data, list):
            return []
        opps = []
        for coin in data[:10]:
            score = quick_score(65, [5])
            token = coin.get("symbol", "???").upper()
            name = coin.get("name", "Unknown")
            opps.append(Opportunity(
                category="listings",
                title=f"New Listing: {name} ({token}) — CoinGecko",
                summary=f"New token listed: {name} ({token})",
                source_url=f"https://www.coingecko.com/en/coins/{coin.get('id', '')}",
                whale_score=score,
                raw_data={
                    "token": f"{name} ({token})",
                    "exchange": "CoinGecko (New Listing)",
                    "date": "Now",
                    "impact": "Monitor",
                    "url": f"https://www.coingecko.com/en/coins/{coin.get('id', '')}",
                    "whale_score": score,
                },
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
                    if not any(k in combined for k in LISTING_KEYWORDS):
                        continue
                    exchange = "Unknown Exchange"
                    for ex in MAJOR_EXCHANGES:
                        if ex in combined:
                            exchange = ex.title()
                            break
                    score = quick_score(70, [15 if exchange in ("Binance", "Coinbase") else 5])
                    opps.append(Opportunity(
                        category="listings",
                        title=title[:200],
                        summary=desc[:400],
                        source_url=link,
                        whale_score=score,
                        raw_data={
                            "token": title[:60],
                            "exchange": exchange,
                            "date": "Recent",
                            "impact": "High" if score >= 80 else "Medium",
                            "url": link,
                            "whale_score": score,
                        },
                    ))
            except Exception as e:
                logger.error(f"Listing RSS error: {e}")
        return opps


class SmartMoneyCollector(BaseCollector):
    category = "smartmoney"

    async def collect(self) -> list[Opportunity]:
        return await self._collect_from_defillama()

    async def _collect_from_defillama(self) -> list[Opportunity]:
        data = await self._get(f"{DEFILLAMA_BASE}/protocols")
        if not isinstance(data, list):
            return []
        opps = []
        rising = sorted(
            [p for p in data if isinstance(p.get("change_1d"), (int, float))],
            key=lambda x: x.get("change_1d", 0),
            reverse=True,
        )[:5]
        for protocol in rising:
            change = protocol.get("change_1d", 0)
            tvl = protocol.get("tvl", 0)
            if tvl < 1_000_000:
                continue
            score = quick_score(65, [
                20 if change >= 50 else 10 if change >= 20 else 0,
                10 if tvl >= 100_000_000 else 5 if tvl >= 10_000_000 else 0,
            ])
            name = protocol.get("name", "Unknown")
            opps.append(Opportunity(
                category="smartmoney",
                title=f"Smart Money Signal: {name} — TVL +{change:.1f}%",
                summary=f"TVL: ${tvl:,.0f}, 24h Change: +{change:.1f}%",
                source_url=f"https://defillama.com/protocol/{protocol.get('slug', '')}",
                whale_score=score,
                raw_data={
                    "token": name,
                    "action": "TVL Accumulation",
                    "amount": f"${tvl:,.0f} TVL",
                    "wallet_type": "DeFi Protocol",
                    "url": f"https://defillama.com/protocol/{protocol.get('slug', '')}",
                    "whale_score": score,
                },
            ))
        return opps
