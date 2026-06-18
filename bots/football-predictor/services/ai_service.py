from __future__ import annotations

import logging

import anthropic

from config import ANTHROPIC_API_KEY

logger = logging.getLogger(__name__)

_client: anthropic.AsyncAnthropic | None = None


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
    return _client


async def generate_match_analysis(
    home_team: str,
    away_team: str,
    league: str,
    lang: str = "en",
) -> str:
    """Generate AI match analysis using Claude. Returns analysis text."""
    if not ANTHROPIC_API_KEY:
        logger.warning("ANTHROPIC_API_KEY not set")
        return ""

    system_prompts = {
        "en": (
            "You are a professional football analyst. Provide a concise, data-driven match preview "
            "covering: recent form (last 5 games), head-to-head record, key players to watch, "
            "predicted lineup impacts, and a brief prediction. Keep it under 300 words. "
            "Format with short sections using emojis for readability."
        ),
        "ko": (
            "당신은 전문 축구 분석가입니다. 간결하고 데이터 기반의 경기 프리뷰를 제공하세요. "
            "포함 내용: 최근 5경기 폼, 최근 맞대결 기록, 주목할 선수, 예상 선발진 영향, 간단한 예측. "
            "300자 이내로 작성하고 이모지를 활용해 가독성을 높이세요."
        ),
        "vi": (
            "Bạn là một nhà phân tích bóng đá chuyên nghiệp. Cung cấp phân tích trận đấu ngắn gọn dựa trên dữ liệu: "
            "phong độ gần đây (5 trận), lịch sử đối đầu, cầu thủ đáng chú ý, tác động đội hình dự kiến, và dự đoán ngắn. "
            "Giữ trong 300 từ. Dùng emoji để dễ đọc."
        ),
    }

    user_messages = {
        "en": f"Analyze the upcoming match: {home_team} vs {away_team} in {league}. Provide your analysis and prediction.",
        "ko": f"다음 경기를 분석해 주세요: {league} — {home_team} vs {away_team}. 분석과 예측을 제공하세요.",
        "vi": f"Phân tích trận đấu sắp tới: {home_team} vs {away_team} tại {league}. Cung cấp phân tích và dự đoán.",
    }

    system = system_prompts.get(lang, system_prompts["en"])
    user_msg = user_messages.get(lang, user_messages["en"])

    try:
        client = _get_client()
        message = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            system=system,
            messages=[{"role": "user", "content": user_msg}],
        )
        return message.content[0].text if message.content else ""
    except Exception as exc:
        logger.error("Claude API error: %s", exc)
        return ""
