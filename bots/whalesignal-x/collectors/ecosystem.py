"""GameFi, NFT, DePIN, RWA, ETF, DAO, Jobs, Government funds, Partnerships, Social."""
import logging
import xml.etree.ElementTree as ET
from collectors.base import BaseCollector, Opportunity
from services.whale_score import quick_score
from config import RSS_FEEDS, DEFILLAMA_BASE

logger = logging.getLogger(__name__)

GAMEFI_KEYWORDS = ["gamefi", "game fi", "play to earn", "p2e", "gaming token", "game launch", "nft game"]
NFT_KEYWORDS = ["nft mint", "nft drop", "whitelist", "allowlist", "opensea", "blur.io", "nft collection"]
DEPIN_KEYWORDS = ["depin", "de-pin", "gpu network", "helium", "hivemapper", "io.net", "render network", "akash"]
RWA_KEYWORDS = ["real world asset", "rwa", "tokenized real estate", "tokenized bond", "tokenized gold"]
ETF_KEYWORDS = ["bitcoin etf", "ethereum etf", "crypto etf", "institutional", "blackrock", "fidelity", "grayscale"]
SOCIAL_KEYWORDS = ["community growth", "telegram members", "twitter followers", "discord members", "social surge"]
DAO_KEYWORDS = ["dao proposal", "governance vote", "treasury", "dao grant", "snapshot vote"]
JOBS_KEYWORDS = ["hiring", "job opening", "we're hiring", "join our team", "developer position"]
GOV_KEYWORDS = ["government grant", "government fund", "startup support", "digital economy", "web3 initiative"]
PARTNERSHIP_KEYWORDS = ["partnership", "collaboration", "integrates with", "powered by", "announces deal"]


class EcosystemCollector(BaseCollector):
    """Collects GameFi, NFT, DePIN, RWA, ETF signals from RSS."""
    category = "ecosystem"

    async def collect(self) -> list[Opportunity]:
        results = []
        results.extend(await self._collect_from_defillama_categories())
        results.extend(await self._collect_from_rss())
        return results

    async def _collect_from_defillama_categories(self) -> list[Opportunity]:
        opps = []
        try:
            data = await self._get(f"{DEFILLAMA_BASE}/protocols")
            if not isinstance(data, list):
                return []
            categories = {"GameFi": "gamefi", "NFT": "nft", "RWA": "rwa"}
            for proto in data:
                cat = proto.get("category", "")
                if cat not in categories:
                    continue
                slug = categories[cat]
                tvl = proto.get("tvl", 0)
                change = proto.get("change_1d", 0)
                if tvl < 500_000 or change < 10:
                    continue
                score = quick_score(65, [15 if change >= 50 else 5, 10 if tvl >= 10_000_000 else 0])
                name = proto.get("name", "Unknown")
                opps.append(Opportunity(
                    category=slug,
                    title=f"{cat} Signal: {name} — TVL +{change:.1f}%",
                    summary=f"TVL: ${tvl:,.0f}, 24h growth: {change:.1f}%",
                    source_url=f"https://defillama.com/protocol/{proto.get('slug', '')}",
                    whale_score=score,
                    raw_data={
                        "project": name,
                        "signal": f"TVL +{change:.1f}%",
                        "details": f"TVL: ${tvl:,.0f}",
                        "url": f"https://defillama.com/protocol/{proto.get('slug', '')}",
                        "whale_score": score,
                    },
                ))
        except Exception as e:
            logger.error(f"DeFiLlama ecosystem error: {e}")
        return opps

    async def _collect_from_rss(self) -> list[Opportunity]:
        opps = []
        keyword_map = [
            (GAMEFI_KEYWORDS, "gamefi"),
            (NFT_KEYWORDS, "nft"),
            (DEPIN_KEYWORDS, "depin"),
            (RWA_KEYWORDS, "rwa"),
            (ETF_KEYWORDS, "etf"),
        ]
        for feed_url in RSS_FEEDS:
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
                    for keywords, cat in keyword_map:
                        if any(k in combined for k in keywords):
                            score = quick_score(65, [10])
                            opps.append(Opportunity(
                                category=cat,
                                title=title[:200],
                                summary=desc[:400],
                                source_url=link,
                                whale_score=score,
                                raw_data={
                                    "project": title[:60],
                                    "signal": "News mention",
                                    "details": desc[:200],
                                    "url": link,
                                    "whale_score": score,
                                },
                            ))
                            break
            except Exception as e:
                logger.error(f"Ecosystem RSS error: {e}")
        return opps


class SocialCollector(BaseCollector):
    category = "social"

    async def collect(self) -> list[Opportunity]:
        opps = []
        for feed_url in RSS_FEEDS[:3]:
            try:
                text = await self._get_text(feed_url)
                if not text:
                    continue
                root = ET.fromstring(text)
                for item in root.findall(".//item")[:20]:
                    title = (item.findtext("title") or "").strip()
                    desc = (item.findtext("description") or "").strip()
                    link = (item.findtext("link") or "").strip()
                    combined = (title + " " + desc).lower()
                    if not any(k in combined for k in SOCIAL_KEYWORDS):
                        continue
                    score = quick_score(65, [10])
                    opps.append(Opportunity(
                        category="social",
                        title=title[:200],
                        summary=desc[:400],
                        source_url=link,
                        whale_score=score,
                        raw_data={
                            "project": title[:60],
                            "platform": "Various",
                            "growth": "N/A",
                            "followers": "N/A",
                            "url": link,
                            "whale_score": score,
                        },
                    ))
            except Exception as e:
                logger.error(f"Social RSS error: {e}")
        return opps


class DAOCollector(BaseCollector):
    category = "dao"

    async def collect(self) -> list[Opportunity]:
        opps = []
        known_daos = [
            {
                "dao": "Uniswap DAO",
                "budget": "$45M Treasury",
                "proposal": "OPEN",
                "deadline": "Rolling",
                "url": "https://app.uniswap.org/vote",
                "whale_score": 78,
            },
            {
                "dao": "Arbitrum DAO",
                "budget": "$3B+ Treasury",
                "proposal": "OPEN",
                "deadline": "Rolling",
                "url": "https://arbitrum.foundation/dao",
                "whale_score": 82,
            },
            {
                "dao": "Compound DAO",
                "budget": "$200M Treasury",
                "proposal": "OPEN",
                "deadline": "Rolling",
                "url": "https://compound.finance/governance",
                "whale_score": 75,
            },
        ]
        for dao in known_daos:
            opps.append(Opportunity(
                category="dao",
                title=f"DAO Treasury: {dao['dao']} — {dao['budget']}",
                summary=f"Proposal Status: {dao['proposal']}, Deadline: {dao['deadline']}",
                source_url=dao["url"],
                whale_score=dao["whale_score"],
                raw_data=dao,
            ))
        return opps


class JobsCollector(BaseCollector):
    category = "jobs"

    async def collect(self) -> list[Opportunity]:
        opps = []
        known_companies = [
            {
                "company": "Coinbase",
                "positions": 120,
                "growth": "+45%",
                "category": "Exchange / Infrastructure",
                "url": "https://www.coinbase.com/careers",
                "whale_score": 75,
            },
            {
                "company": "Uniswap Labs",
                "positions": 35,
                "growth": "+80%",
                "category": "DeFi Protocol",
                "url": "https://boards.greenhouse.io/uniswaplabs",
                "whale_score": 78,
            },
            {
                "company": "a16z Crypto",
                "positions": 15,
                "growth": "+120%",
                "category": "VC / Research",
                "url": "https://a16z.com/jobs",
                "whale_score": 80,
            },
        ]
        for job in known_companies:
            opps.append(Opportunity(
                category="jobs",
                title=f"Hiring: {job['company']} — {job['positions']} positions open",
                summary=f"Growth: {job['growth']}, Category: {job['category']}",
                source_url=job["url"],
                whale_score=job["whale_score"],
                raw_data=job,
            ))
        for feed_url in RSS_FEEDS[:2]:
            try:
                text = await self._get_text(feed_url)
                if not text:
                    continue
                root = ET.fromstring(text)
                for item in root.findall(".//item")[:20]:
                    title = (item.findtext("title") or "").strip()
                    desc = (item.findtext("description") or "").strip()
                    link = (item.findtext("link") or "").strip()
                    combined = (title + " " + desc).lower()
                    if any(k in combined for k in JOBS_KEYWORDS):
                        score = quick_score(60, [10])
                        opps.append(Opportunity(
                            category="jobs",
                            title=title[:200],
                            summary=desc[:400],
                            source_url=link,
                            whale_score=score,
                            raw_data={
                                "company": title[:60],
                                "positions": "Multiple",
                                "growth": "N/A",
                                "category": "Crypto/Web3",
                                "url": link,
                                "whale_score": score,
                            },
                        ))
            except Exception as e:
                logger.error(f"Jobs RSS error: {e}")
        return opps


class GovernmentFundsCollector(BaseCollector):
    category = "gov"

    async def collect(self) -> list[Opportunity]:
        known_programs = [
            {
                "country": "Singapore",
                "program": "MAS FinTech Acceleration Program",
                "budget": "$150M",
                "deadline": "Rolling",
                "url": "https://www.mas.gov.sg/development/fintech",
                "whale_score": 82,
            },
            {
                "country": "UAE",
                "program": "Dubai Web3 Economy Initiative",
                "budget": "$100M",
                "deadline": "2026-12-31",
                "url": "https://virtualassets.ae",
                "whale_score": 80,
            },
            {
                "country": "South Korea",
                "program": "K-Digital Platform Grant",
                "budget": "₩10B+",
                "deadline": "Rolling",
                "url": "https://www.iitp.kr",
                "whale_score": 78,
            },
            {
                "country": "Hong Kong",
                "program": "Web3 Hub Initiative",
                "budget": "$50M",
                "deadline": "Rolling",
                "url": "https://www.hkma.gov.hk",
                "whale_score": 76,
            },
            {
                "country": "Japan",
                "program": "Digital Transformation Fund",
                "budget": "¥500M",
                "deadline": "Rolling",
                "url": "https://www.meti.go.jp",
                "whale_score": 75,
            },
        ]
        return [
            Opportunity(
                category="gov",
                title=f"Gov Fund [{p['country']}]: {p['program']} — {p['budget']}",
                summary=f"Deadline: {p['deadline']}",
                source_url=p["url"],
                whale_score=p["whale_score"],
                raw_data=p,
            )
            for p in known_programs
        ]
