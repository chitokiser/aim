from collectors.funding import FundingCollector
from collectors.grants import GrantsCollector
from collectors.airdrop import AirdropCollector
from collectors.github_tracker import GitHubCollector
from collectors.exchange_listing import ExchangeListingCollector, SmartMoneyCollector
from collectors.ecosystem import (
    EcosystemCollector, SocialCollector, DAOCollector,
    JobsCollector, GovernmentFundsCollector,
)
from collectors.news_sentiment import NewsSentimentCollector, HiddenGemCollector

ALL_COLLECTORS = [
    FundingCollector(),
    GrantsCollector(),
    AirdropCollector(),
    GitHubCollector(),
    ExchangeListingCollector(),
    SmartMoneyCollector(),
    EcosystemCollector(),
    SocialCollector(),
    DAOCollector(),
    JobsCollector(),
    GovernmentFundsCollector(),
    NewsSentimentCollector(),
    HiddenGemCollector(),
]

CATEGORY_MAP = {
    "funding": [FundingCollector()],
    "grants": [GrantsCollector()],
    "grant": [GrantsCollector()],
    "hackathon": [GrantsCollector()],
    "airdrop": [AirdropCollector()],
    "testnet": [AirdropCollector()],
    "github": [GitHubCollector()],
    "listings": [ExchangeListingCollector()],
    "smartmoney": [SmartMoneyCollector()],
    "social": [SocialCollector()],
    "dao": [DAOCollector()],
    "jobs": [JobsCollector()],
    "gov": [GovernmentFundsCollector()],
    "gamefi": [EcosystemCollector()],
    "nft": [EcosystemCollector()],
    "depin": [EcosystemCollector()],
    "rwa": [EcosystemCollector()],
    "etf": [EcosystemCollector()],
    "hidden": [HiddenGemCollector()],
    "news": [NewsSentimentCollector()],
}
