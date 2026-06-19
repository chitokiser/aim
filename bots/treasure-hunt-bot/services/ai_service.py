"""AI question generation via Groq + reverse geocoding via Nominatim."""

import json
import logging
import asyncio
import aiohttp
from groq import AsyncGroq
from config import GROQ_API_KEY, GROQ_MODEL

logger = logging.getLogger(__name__)

_groq_client: AsyncGroq | None = None


def _groq() -> AsyncGroq:
    global _groq_client
    if _groq_client is None:
        _groq_client = AsyncGroq(api_key=GROQ_API_KEY)
    return _groq_client


async def reverse_geocode(lat: float, lon: float) -> dict:
    """Use Nominatim (OpenStreetMap) to get human-readable location from coordinates."""
    url = (
        f"https://nominatim.openstreetmap.org/reverse"
        f"?lat={lat}&lon={lon}&format=json&accept-language=ko"
    )
    headers = {"User-Agent": "TreasureHuntBot/1.0 (ai119@example.com)"}
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 200:
                    return await resp.json()
    except Exception as e:
        logger.warning("Nominatim geocoding failed: %s", e)
    return {}


def build_location_context(lat: float, lon: float, geo: dict) -> str:
    address = geo.get("address", {})
    display = geo.get("display_name", f"{lat:.4f}, {lon:.4f}")
    country = address.get("country", "N/A")
    state = address.get("state", address.get("province", "N/A"))
    city = (
        address.get("city")
        or address.get("town")
        or address.get("village")
        or address.get("municipality")
        or "N/A"
    )
    district = (
        address.get("city_district")
        or address.get("suburb")
        or address.get("neighbourhood")
        or "N/A"
    )
    road = address.get("road", "N/A")

    return (
        f"GPS 좌표: {lat:.6f}, {lon:.6f}\n"
        f"전체 주소: {display}\n"
        f"국가: {country}\n"
        f"광역: {state}\n"
        f"도시: {city}\n"
        f"구/동: {district}\n"
        f"도로: {road}"
    )


QUESTION_SYSTEM = """\
당신은 AI 보물찾기 퀴즈 제작자입니다.
GPS 좌표와 위치 정보를 기반으로, 해당 장소를 특정하는 데 도움이 되는 10개의 객관식 문제를 한국어로 생성하세요.
단, 좌표나 정확한 주소를 문제에 직접 포함해서는 안 됩니다.

문제 진행 기준:
- Q1~Q2: 대륙/국가 수준 (매우 넓은 범위)
- Q3~Q4: 광역/주 수준
- Q5~Q6: 도시/지역구 수준
- Q7~Q8: 동네/지역 특성
- Q9~Q10: 매우 구체적인 현지 단서

각 문제 형식:
- question: 질문 내용 (한국어, 장소의 방향/거리/지형/문화/기후/랜드마크 등 활용)
- options: 정확히 4개의 선택지 배열 [A, B, C, D] (한국어)
- answer: 정답 인덱스 (0=A, 1=B, 2=C, 3=D)
- hints: 3개의 힌트 배열 [레벨1(매우 모호), 레벨2(보통), 레벨3(거의 정답)]

반드시 JSON으로만 응답: {"questions": [10개의 문제 객체 배열]}
"""


async def generate_questions(lat: float, lon: float, geo: dict) -> list[dict]:
    """Generate 10 MCQ questions about the location using Groq."""
    location_context = build_location_context(lat, lon, geo)

    try:
        response = await _groq().chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": QUESTION_SYSTEM},
                {
                    "role": "user",
                    "content": (
                        f"다음 위치에 대한 보물찾기 10문제를 생성해주세요:\n\n{location_context}\n\n"
                        "JSON만 응답하세요. 문제는 반드시 10개여야 합니다."
                    ),
                },
            ],
            temperature=0.75,
            max_tokens=4096,
            response_format={"type": "json_object"},
        )

        raw = response.choices[0].message.content or "{}"
        data = json.loads(raw)

        # Groq may return {"questions": [...]} or {"questions": {...}} — normalise
        questions = data.get("questions", [])
        if isinstance(questions, dict):
            questions = list(questions.values())

        valid = [q for q in questions if isinstance(q, dict) and "question" in q]
        if len(valid) >= 5:
            logger.info("AI generated %d questions for (%.4f, %.4f)", len(valid), lat, lon)
            return valid[:10]

    except Exception as e:
        logger.error("Groq question generation failed: %s", e)

    # Fallback: basic directional questions so the game is still playable
    return _fallback_questions(lat, lon, geo)


def _fallback_questions(lat: float, lon: float, geo: dict) -> list[dict]:
    address = geo.get("address", {})
    country = address.get("country", "알 수 없음")
    hemisphere_lat = "북반구" if lat >= 0 else "남반구"
    hemisphere_lon = "동반구" if lon >= 0 else "서반구"

    def q(question, options, answer, hints):
        return {"question": question, "options": options, "answer": answer, "hints": hints}

    return [
        q(
            "이 보물이 숨겨진 장소는 어느 반구에 있나요?",
            [hemisphere_lat, "남반구" if lat >= 0 else "북반구", "두 반구 모두", "알 수 없음"],
            0,
            ["지구본을 보세요", "적도를 기준으로 생각해보세요", f"위도는 {'양수' if lat >= 0 else '음수'}입니다"],
        ),
        q(
            "이 장소는 동반구와 서반구 중 어디에 속하나요?",
            [hemisphere_lon, "서반구" if lon >= 0 else "동반구", "본초자오선 위", "날짜변경선 위"],
            0,
            ["경도 0도를 기준으로", "그리니치 천문대를 기준으로", f"경도는 {'양수' if lon >= 0 else '음수'}입니다"],
        ),
        q(
            "이 보물이 있는 나라는 어디인가요?",
            [country, "일본", "미국", "프랑스"],
            0,
            ["아시아 혹은 다른 대륙일 수 있습니다", "지도를 떠올려보세요", f"이 나라는 '{country[0]}' 로 시작합니다"],
        ),
    ] + [
        q(
            f"Q{i} — 좌표 단서를 찾아보세요 (위도 약 {abs(lat):.0f}°)",
            ["단서A", "단서B", "단서C", "단서D"],
            0,
            ["힌트1", "힌트2", "힌트3"],
        )
        for i in range(4, 11)
    ]


def build_coordinate_clues(lat: float, lon: float) -> list[str]:
    """
    Generate 10 progressive coordinate reveals.
    Q1 correct → vague range; Q10 correct → exact coordinates.
    """
    clues = []
    for i in range(1, 11):
        if i <= 2:
            clues.append(
                f"위도: {'+' if lat >= 0 else ''}{int(lat)}°** 대\n"
                f"경도: {'+' if lon >= 0 else ''}{int(lon)}°** 대"
            )
        elif i <= 4:
            clues.append(
                f"위도: {lat:.1f}**°\n"
                f"경도: {lon:.1f}**°"
            )
        elif i <= 6:
            clues.append(
                f"위도: {lat:.2f}**°\n"
                f"경도: {lon:.2f}**°"
            )
        elif i <= 8:
            clues.append(
                f"위도: {lat:.3f}**°\n"
                f"경도: {lon:.3f}**°"
            )
        elif i == 9:
            clues.append(
                f"위도: {lat:.5f}°\n"
                f"경도: {lon:.5f}°"
            )
        else:
            clues.append(
                f"🎯 전체 좌표 공개!\n"
                f"위도: {lat:.6f}\n"
                f"경도: {lon:.6f}"
            )
    return clues
