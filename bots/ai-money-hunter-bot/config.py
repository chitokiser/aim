import os
from dotenv import load_dotenv

load_dotenv()

# Telegram
BOT_TOKEN = os.getenv("BOT_TOKEN", "")
ADMIN_IDS = [int(x) for x in os.getenv("ADMIN_IDS", "").split(",") if x.strip()]

# Groq (free — https://console.groq.com)
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

# Tavily
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")

# Alpha Vantage (optional fallback)
ALPHA_VANTAGE_KEY = os.getenv("ALPHA_VANTAGE_KEY", "")

# Database
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:password@localhost:5432/moneyhunter")

# Schedule times (KST = UTC+9)
MORNING_HOUR = int(os.getenv("MORNING_HOUR", "9"))
EVENING_HOUR = int(os.getenv("EVENING_HOUR", "18"))
TIMEZONE = os.getenv("TIMEZONE", "Asia/Seoul")

# Partner links
PARTNER_PLATFORM_URL = "https://ai119.netlify.app/"
PARTNER_COMMUNITY_URL = "https://t.me/ai119"
