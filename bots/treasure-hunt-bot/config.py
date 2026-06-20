import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN", "")
GROUP_CHAT_ID = int(os.getenv("GROUP_CHAT_ID", "0"))
ADMIN_IDS = [int(x) for x in os.getenv("ADMIN_IDS", "").split(",") if x.strip()]

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

THREADS_USER_ID = os.getenv("THREADS_USER_ID", "")
THREADS_ACCESS_TOKEN = os.getenv("THREADS_ACCESS_TOKEN", "")

BLOGGER_CLIENT_ID = os.getenv("BLOGGER_CLIENT_ID", "")
BLOGGER_CLIENT_SECRET = os.getenv("BLOGGER_CLIENT_SECRET", "")
BLOGGER_REFRESH_TOKEN = os.getenv("BLOGGER_REFRESH_TOKEN", "")
BLOGGER_BLOG_ID = os.getenv("BLOGGER_BLOG_ID", "")

FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "")
FIREBASE_CLIENT_EMAIL = os.getenv("FIREBASE_CLIENT_EMAIL", "")
FIREBASE_PRIVATE_KEY = os.getenv("FIREBASE_PRIVATE_KEY", "").replace("\\n", "\n")

HINT_COSTS = {1: 100, 2: 300, 3: 500}
STARTING_P = 1000

COMMUNITY_URL = "https://t.me/ai119link"
JUMPWORLD_URL = "https://jump22.netlify.app/merchants"
PLATFORM_URL = "https://ai119.netlify.app"
