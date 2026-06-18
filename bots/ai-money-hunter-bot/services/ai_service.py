"""Groq (Llama 3.3-70b) + Tavily: generate hustle ideas and trend analysis."""

import json
import asyncio
from groq import AsyncGroq
from tavily import TavilyClient
from config import GROQ_API_KEY, GROQ_MODEL, TAVILY_API_KEY

_groq_client: AsyncGroq | None = None
_tavily_client: TavilyClient | None = None


def _groq() -> AsyncGroq:
    global _groq_client
    if _groq_client is None:
        _groq_client = AsyncGroq(api_key=GROQ_API_KEY)
    return _groq_client


def _tavily() -> TavilyClient:
    global _tavily_client
    if _tavily_client is None:
        _tavily_client = TavilyClient(api_key=TAVILY_API_KEY)
    return _tavily_client

HUSTLE_SYSTEM = """You are an AI money opportunity analyst.
You analyze current internet trends and generate actionable side hustle ideas.
Always respond in the following JSON format exactly:
{
  "title": "Side hustle name",
  "category": "AI / Content / E-commerce / Service / etc",
  "monthly_income_min": 500,
  "monthly_income_max": 3000,
  "difficulty": "쉬움 | 보통 | 어려움",
  "competition": "낮음 | 보통 | 높음",
  "start_cost_min": 0,
  "start_cost_max": 50,
  "growth_potential": "높음 | 보통 | 낮음",
  "description": "2-3 sentence description of the opportunity",
  "steps": ["Step 1", "Step 2", "Step 3"],
  "tools": ["Tool 1", "Tool 2"],
  "why_now": "Why this is a hot opportunity right now (1 sentence)"
}"""

TREND_SYSTEM = """You are a market trend analyst.
Summarize the latest AI and money-making trends based on provided search results.
Write in Korean. Be concise and actionable. Use bullet points."""


async def _search_trends(query: str) -> str:
    def _run():
        result = _tavily().search(
            query=query,
            search_depth="advanced",
            max_results=5,
            include_answer=True,
        )
        snippets = [r.get("content", "") for r in result.get("results", [])]
        answer = result.get("answer", "")
        return answer + "\n\n" + "\n---\n".join(snippets)

    try:
        return await asyncio.to_thread(_run)
    except Exception:
        return ""


async def generate_hustle_idea() -> dict:
    search_context = await _search_trends(
        "best AI side hustle opportunities 2025 make money online trending now"
    )

    response = await _groq().chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": HUSTLE_SYSTEM},
            {
                "role": "user",
                "content": (
                    f"Based on these current trends:\n{search_context[:3000]}\n\n"
                    "Generate ONE highly specific, actionable side hustle idea that is trending RIGHT NOW. "
                    "Focus on AI tools, content creation, or digital services. Respond in JSON only."
                ),
            },
        ],
        temperature=0.8,
        max_tokens=1024,
        response_format={"type": "json_object"},
    )

    text = response.choices[0].message.content
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {
            "title": "AI 콘텐츠 자동화 서비스",
            "category": "AI / Content",
            "monthly_income_min": 500,
            "monthly_income_max": 3000,
            "difficulty": "쉬움",
            "competition": "보통",
            "start_cost_min": 0,
            "start_cost_max": 50,
            "growth_potential": "높음",
            "description": "AI 도구를 사용해 숏폼 영상을 자동 생성하고 SNS에 업로드하는 서비스",
            "steps": ["Runway/Pika로 영상 생성", "SNS 채널 개설", "클라이언트 수주"],
            "tools": ["ChatGPT", "Runway ML", "Canva"],
            "why_now": "숏폼 콘텐츠 수요가 폭발적으로 증가하고 있음",
        }


def format_hustle_message(idea: dict) -> str:
    income_min = idea.get("monthly_income_min", 0)
    income_max = idea.get("monthly_income_max", 0)
    cost_min = idea.get("start_cost_min", 0)
    cost_max = idea.get("start_cost_max", 50)

    steps_text = "\n".join(f"   {i+1}. {s}" for i, s in enumerate(idea.get("steps", [])))
    tools_text = " · ".join(idea.get("tools", []))

    return (
        f"🔥 *오늘의 돈벌이 기회*\n\n"
        f"📌 *{idea['title']}*\n"
        f"🏷 카테고리: {idea.get('category', 'N/A')}\n\n"
        f"💰 예상수익: *${income_min:,} ~ ${income_max:,} / month*\n"
        f"🧩 난이도: {idea.get('difficulty', 'N/A')}\n"
        f"📊 경쟁도: {idea.get('competition', 'N/A')}\n"
        f"💵 시작비용: ${cost_min} ~ ${cost_max}\n"
        f"📈 성장가능성: {idea.get('growth_potential', 'N/A')}\n\n"
        f"📝 *설명*\n{idea.get('description', '')}\n\n"
        f"⚡ *지금 뜨는 이유*\n{idea.get('why_now', '')}\n\n"
        f"🛠 *필요 도구*\n{tools_text}\n\n"
        f"📋 *시작 단계*\n{steps_text}"
    )


async def analyze_trends() -> str:
    queries = [
        "AI money making trends 2025",
        "best side hustle opportunities June 2025",
        "AI tools earning money online 2025",
    ]

    contexts = []
    for q in queries:
        ctx = await _search_trends(q)
        if ctx:
            contexts.append(ctx[:1500])

    combined = "\n\n---\n\n".join(contexts)

    response = await _groq().chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": TREND_SYSTEM},
            {
                "role": "user",
                "content": (
                    f"다음 최신 검색 결과를 바탕으로 AI 및 돈벌이 트렌드를 요약해주세요:\n\n{combined[:4000]}\n\n"
                    "한국어로, 핵심만, 불릿포인트 5개로 요약해주세요."
                ),
            },
        ],
        temperature=0.5,
        max_tokens=800,
    )

    summary = response.choices[0].message.content
    return f"🧠 *AI 트렌드 분석*\n\n{summary}"
