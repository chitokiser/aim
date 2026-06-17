import json
from typing import Optional
import anthropic
from config import ANTHROPIC_API_KEY, AI_MODEL_FAST, AI_MODEL_DEEP

_client: Optional[anthropic.Anthropic] = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    return _client


async def analyze_opportunity(title: str, summary: str, category: str) -> dict:
    """Use Claude to analyze an opportunity and return structured insights."""
    prompt = f"""Analyze this Web3/crypto opportunity and return a JSON response.

Category: {category}
Title: {title}
Summary: {summary}

Return JSON with these exact keys:
{{
  "whale_score": <integer 0-100>,
  "sentiment": "<positive|neutral|negative>",
  "key_signals": ["signal1", "signal2", "signal3"],
  "risk_level": "<low|medium|high>",
  "time_sensitivity": "<urgent|moderate|low>",
  "recommendation": "<STRONG RESEARCH|RESEARCH|MONITOR|SKIP>"
}}

WhaleScore criteria:
- Funding amount > $10M: +20
- Top-tier VC: +15
- Active community growth: +10
- Strong GitHub activity: +10
- Multiple positive signals: +10
- Open deadline soon: +10
- Low competition: +10
- Novel technology: +5

Return ONLY valid JSON, no explanation."""

    try:
        client = _get_client()
        resp = client.messages.create(
            model=AI_MODEL_FAST,
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
        text = resp.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)
    except Exception as e:
        return {
            "whale_score": 60,
            "sentiment": "neutral",
            "key_signals": [],
            "risk_level": "medium",
            "time_sensitivity": "moderate",
            "recommendation": "MONITOR",
        }


async def generate_daily_digest(opportunities: list) -> str:
    """Generate a natural language daily digest from top opportunities."""
    if not opportunities:
        return "오늘 주목할 만한 신호가 없습니다."

    opp_text = "\n".join([
        f"- [{o.get('category')}] {o.get('title')} (WhaleScore: {o.get('whale_score')})"
        for o in opportunities[:10]
    ])

    prompt = f"""You are WhaleSignal X, an AI Opportunity Intelligence platform.
Summarize today's top opportunities in Korean for Telegram users.
Keep it concise, exciting, and actionable. Use emojis. Max 300 words.

Today's signals:
{opp_text}

Format:
🌊 오늘의 WhaleSignal X 브리핑

[3-5 bullet points with key opportunities]

⚠️ 투자 권유가 아닌 리서치 참고 정보입니다."""

    try:
        client = _get_client()
        resp = client.messages.create(
            model=AI_MODEL_FAST,
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        )
        return resp.content[0].text.strip()
    except Exception as e:
        return "🌊 오늘의 WhaleSignal X 브리핑\n\n데이터를 분석 중입니다. 잠시 후 다시 확인해주세요."


async def analyze_hidden_gems(projects: list) -> list:
    """Use Claude to find hidden gems from a list of emerging projects."""
    if not projects:
        return []

    projects_text = json.dumps(projects[:20], ensure_ascii=False)

    prompt = f"""Analyze these emerging crypto/Web3 projects and identify hidden gems.
Return JSON array of top 3 projects with highest potential but low current visibility.

Projects: {projects_text}

Return JSON array:
[
  {{
    "project": "name",
    "visibility": "Low|Medium",
    "potential": "Very High|High|Medium",
    "category": "AI|DeFi|GameFi|NFT|DePIN|Infrastructure",
    "key_reason": "why this is a hidden gem",
    "whale_score": <integer 75-100>
  }}
]

Return ONLY valid JSON array."""

    try:
        client = _get_client()
        resp = client.messages.create(
            model=AI_MODEL_DEEP,
            max_tokens=800,
            messages=[{"role": "user", "content": prompt}],
        )
        text = resp.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)
    except Exception:
        return []


async def analyze_news_sentiment(news_items: list) -> dict:
    """Analyze overall market sentiment from news headlines."""
    if not news_items:
        return {"sentiment": "neutral", "score": 50, "summary": "데이터 없음"}

    headlines = "\n".join([f"- {item.get('title', '')}" for item in news_items[:20]])

    prompt = f"""Analyze the market sentiment from these crypto/Web3 news headlines.

Headlines:
{headlines}

Return JSON:
{{
  "sentiment": "<bullish|neutral|bearish>",
  "score": <0-100, where 100 is most bullish>,
  "top_positive": ["headline1", "headline2"],
  "top_negative": ["headline1", "headline2"],
  "summary": "<one sentence summary in Korean>"
}}

Return ONLY valid JSON."""

    try:
        client = _get_client()
        resp = client.messages.create(
            model=AI_MODEL_FAST,
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
        text = resp.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)
    except Exception:
        return {"sentiment": "neutral", "score": 50, "summary": "분석 중..."}


async def pick_today_opportunity(opportunities: list) -> Optional[dict]:
    """Pick the single best opportunity of the day."""
    if not opportunities:
        return None

    opps_text = json.dumps([
        {"title": o.get("title"), "category": o.get("category"),
         "score": o.get("whale_score"), "summary": o.get("summary", "")[:200]}
        for o in opportunities[:20]
    ], ensure_ascii=False)

    prompt = f"""From these opportunities, pick the single BEST one for today.

Opportunities: {opps_text}

Return JSON:
{{
  "project": "project name",
  "funding": "funding info or N/A",
  "grant": "grant availability",
  "airdrop": "airdrop status",
  "hiring": "hiring status",
  "whale_score": <integer>,
  "recommendation": "STRONG RESEARCH PRIORITY"
}}

Return ONLY valid JSON."""

    try:
        client = _get_client()
        resp = client.messages.create(
            model=AI_MODEL_FAST,
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        )
        text = resp.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)
    except Exception:
        return None
