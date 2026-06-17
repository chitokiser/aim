import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("WHALASIGNAL_BOT_TOKEN", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///whalesignal.db")
JWT_SECRET = os.getenv("JWT_SECRET", "aim-secret-key")
REDIS_URL = os.getenv("REDIS_URL", "")

ADMIN_IDS = [int(x) for x in os.getenv("ADMIN_IDS", "").split(",") if x.strip().isdigit()]

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
COINGECKO_API_KEY = os.getenv("COINGECKO_API_KEY", "")
CRYPTORANK_API_KEY = os.getenv("CRYPTORANK_API_KEY", "")
NEWS_API_KEY = os.getenv("NEWS_API_KEY", "")
DEFILLAMA_BASE = "https://api.llama.fi"
COINGECKO_BASE = "https://api.coingecko.com/api/v3"
CRYPTORANK_BASE = "https://api.cryptorank.io/v1"
GITHUB_BASE = "https://api.github.com"

AI119_COMMUNITY_URL = "https://t.me/ai119"
AIM_SITE_URL = "https://ai119.netlify.app"

FREE_DAILY_LIMIT = 20
PRO_MONTHLY_USD = 9.99
VIP_MONTHLY_USD = 29.99

AI_MODEL_FAST = "claude-haiku-4-5-20251001"
AI_MODEL_DEEP = "claude-sonnet-4-6"

COLLECT_INTERVAL_MINUTES = 30
DAILY_DIGEST_HOUR = 9

GROUP_CHAT_ID = os.getenv("GROUP_CHAT_ID", "")
BOT_USERNAME = os.getenv("BOT_USERNAME", "WhaleSignalXBot")
GROUP_BROADCAST_MORNING_HOUR = int(os.getenv("GROUP_BROADCAST_MORNING_HOUR", "9"))
GROUP_BROADCAST_EVENING_HOUR = int(os.getenv("GROUP_BROADCAST_EVENING_HOUR", "21"))

RSS_FEEDS = [
    "https://cointelegraph.com/rss",
    "https://decrypt.co/feed",
    "https://thedefiant.io/feed",
    "https://blockworks.co/feed",
    "https://www.coindesk.com/arc/outboundfeeds/rss/",
]

GRANT_PROGRAMS = [
    {"name": "Ethereum Foundation", "url": "https://ethereum.org/en/community/grants/"},
    {"name": "Arbitrum Grants", "url": "https://arbitrum.foundation/grants"},
    {"name": "Base Ecosystem Fund", "url": "https://base.org/grants"},
    {"name": "Optimism RPGF", "url": "https://app.optimism.io/retropgf"},
    {"name": "Solana Foundation", "url": "https://solana.org/grants"},
    {"name": "Polygon Village", "url": "https://polygon.technology/village/grants"},
]

HACKATHON_SOURCES = [
    "https://dorahacks.io/hackathon",
    "https://ethglobal.com/events",
    "https://devpost.com/hackathons",
]
