import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN", "")
ADMIN_IDS = [int(x) for x in os.getenv("ADMIN_IDS", "").split(",") if x.strip()]
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
FOOTBALL_API_KEY = os.getenv("FOOTBALL_API_KEY", "")
ODDS_API_KEY = os.getenv("ODDS_API_KEY", "")
JWT_SECRET = os.getenv("JWT_SECRET", "")
BLOGGER_CLIENT_ID = os.getenv("BLOGGER_CLIENT_ID", "")
BLOGGER_CLIENT_SECRET = os.getenv("BLOGGER_CLIENT_SECRET", "")
BLOGGER_REFRESH_TOKEN = os.getenv("BLOGGER_REFRESH_TOKEN", "")
BLOGGER_BLOG_ID = os.getenv("BLOGGER_BLOG_ID", "")
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "")
FIREBASE_CLIENT_EMAIL = os.getenv("FIREBASE_CLIENT_EMAIL", "")
FIREBASE_PRIVATE_KEY = os.getenv("FIREBASE_PRIVATE_KEY", "").replace("\\n", "\n")
TIMEZONE = os.getenv("TIMEZONE", "Asia/Seoul")
DAILY_P = int(os.getenv("DAILY_P", "10000"))
WELCOME_BONUS_P = int(os.getenv("WELCOME_BONUS_P", "10000"))
GROUP_CHAT_ID = os.getenv("GROUP_CHAT_ID", "")

SITE_URL = "https://ai119.netlify.app"
COMMUNITY_URL = "https://t.me/globalSoccer_b"

# Payout multipliers per prediction type
MULTIPLIERS = {
    "1x2": 1.9,
    "score": 8.0,
    "btts": 1.85,
    "ou": 1.85,
    "first": 2.2,
    "handicap": 1.85,
}

# Football Data API (football-data.org) — free-tier competitions
FOOTBALL_API_BASE = "https://api.football-data.org/v4"
COMPETITIONS = ["PL", "CL", "PD", "BL1", "SA", "FL1", "EC", "WC", "WCQ"]

# Prediction lock window: minutes before kick-off after which no new bets are accepted
BET_CUTOFF_MINUTES = 10
