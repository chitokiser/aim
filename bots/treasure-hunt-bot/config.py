import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN", "")
GROUP_CHAT_ID = int(os.getenv("GROUP_CHAT_ID", "0"))
ADMIN_IDS = [int(x) for x in os.getenv("ADMIN_IDS", "").split(",") if x.strip()]

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./treasurehunt.db")

HINT_COSTS = {1: 100, 2: 300, 3: 500}
STARTING_P = 1000

COMMUNITY_URL = "https://t.me/ai119"
JUMPWORLD_URL = "https://jump22.netlify.app/merchants"
PLATFORM_URL = "https://ai119.netlify.app"
