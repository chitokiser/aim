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


def _parse_answer(val) -> int:
    """Convert AI answer field to 0-indexed int in range 0-3.

    Handles: int (0-3), string digit ("0"-"3"), letter ("A"-"D"), out-of-range (clamped).
    """
    if isinstance(val, str):
        v = val.strip().upper()
        if v in ("A", "B", "C", "D"):
            return {"A": 0, "B": 1, "C": 2, "D": 3}[v]
        try:
            val = int(v)
        except ValueError:
            return 0
    try:
        return max(0, min(3, int(val)))
    except (ValueError, TypeError):
        return 0


def _is_valid_question(q: dict) -> bool:
    """Return True only if the question dict has all required, properly-typed fields."""
    if not isinstance(q, dict):
        return False
    if not isinstance(q.get("question"), str) or not q["question"].strip():
        return False
    options = q.get("options")
    if not isinstance(options, list) or len(options) < 4:
        return False
    if "answer" not in q:
        return False
    hints = q.get("hints")
    if not isinstance(hints, list) or len(hints) < 1:
        return False
    return True


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

        valid = [q for q in questions if _is_valid_question(q)]
        if len(valid) >= 5:
            logger.info("AI generated %d questions for (%.4f, %.4f)", len(valid), lat, lon)
            return valid[:10]

    except Exception as e:
        logger.error("Groq question generation failed: %s", e)

    # Fallback: coordinate-derived questions so the game is still playable
    return _fallback_questions(lat, lon, geo)


def _fallback_questions(lat: float, lon: float, geo: dict) -> list[dict]:
    address = geo.get("address", {})
    country = address.get("country", "알 수 없음")

    ns = "N" if lat >= 0 else "S"
    ew = "E" if lon >= 0 else "W"
    abs_lat = abs(lat)
    abs_lon = abs(lon)

    # Timezone (rough)
    tz = round(lon / 15)
    def tz_str(o: int) -> str:
        return f"UTC{'+' if o >= 0 else ''}{o}"

    # Climate zone (by latitude)
    if abs_lat < 23.5:
        climate, c_wrongs = "열대", ["온대", "아열대", "한대/냉대"]
    elif abs_lat < 35:
        climate, c_wrongs = "아열대", ["열대", "온대", "한대/냉대"]
    elif abs_lat < 60:
        climate, c_wrongs = "온대", ["아열대", "열대", "한대/냉대"]
    else:
        climate, c_wrongs = "한대/냉대", ["온대", "아열대", "열대"]

    # Band starts (always in absolute degrees; direction prefix added by helpers)
    lat10 = int(abs_lat // 10) * 10   # 10° band start, e.g. 37 → 30
    lat5  = int(abs_lat // 5)  * 5    # 5° band start,  e.g. 37 → 35
    lat1  = int(abs_lat)               # nearest integer degree
    lon20 = int(abs_lon // 20) * 20   # 20° band start
    lon5  = int(abs_lon // 5)  * 5    # 5° band start
    lon1  = int(abs_lon)

    def lat_band(start: int, width: int = 10) -> str:
        s = max(0, min(90 - width, start))
        return f"{ns}{s}°~{ns}{s + width}°"

    def lon_band(start: int, width: int = 20) -> str:
        s = max(0, min(180 - width, start))
        return f"{ew}{s}°~{ew}{s + width}°"

    def q(question, options, answer, hints):
        return {"question": question, "options": options, "answer": answer, "hints": hints}

    return [
        # Q1 — north/south hemisphere
        q(
            "이 보물이 숨겨진 장소는 어느 반구에 있나요?",
            ["북반구" if lat >= 0 else "남반구",
             "남반구" if lat >= 0 else "북반구",
             "적도 위 (위도 0°)",
             "알 수 없음"],
            0,
            [
                "지구를 위아래로 나눠보세요",
                "적도(위도 0°)를 기준으로 생각하세요",
                f"위도가 {'양수(+)' if lat >= 0 else '음수(-)'}이면 {'북반구' if lat >= 0 else '남반구'}입니다",
            ],
        ),
        # Q2 — east/west hemisphere
        q(
            "이 장소는 동반구와 서반구 중 어디에 속하나요?",
            ["동반구" if lon >= 0 else "서반구",
             "서반구" if lon >= 0 else "동반구",
             "본초자오선(경도 0°) 위",
             "날짜변경선(경도 180°) 위"],
            0,
            [
                "그리니치 천문대를 기준으로 나눠보세요",
                "경도 0°보다 동쪽이면 동반구입니다",
                f"경도가 {'양수(+)' if lon >= 0 else '음수(-)'}이면 {'동반구' if lon >= 0 else '서반구'}입니다",
            ],
        ),
        # Q3 — country
        q(
            "이 보물이 있는 국가는 어디인가요?",
            [country,
             "일본" if country != "일본" else "중국",
             "미국" if country != "미국" else "캐나다",
             "프랑스" if country != "프랑스" else "독일"],
            0,
            [
                "대륙을 먼저 좁혀보세요",
                f"이 나라의 이름은 '{country[0]}'(으)로 시작합니다",
                f"정답: {country}",
            ],
        ),
        # Q4 — timezone
        q(
            "이 장소의 대략적인 표준시(UTC 기준)는 무엇인가요?",
            [tz_str(tz), tz_str(tz + 3), tz_str(tz - 4), tz_str(tz + 7)],
            0,
            [
                "경도와 시간대는 연관됩니다",
                f"경도 15°마다 1시간 차이가 납니다",
                f"{ew}{abs_lon:.0f}° → {tz_str(tz)}",
            ],
        ),
        # Q5 — climate zone
        q(
            "이 장소의 기후대는 어떻게 되나요?",
            [climate] + c_wrongs,
            0,
            [
                "위도로 기후대를 결정합니다",
                f"적도에서 약 {abs_lat:.0f}° 떨어진 지점입니다",
                f"기후대: {climate}",
            ],
        ),
        # Q6 — latitude 10° band
        q(
            "이 장소가 속하는 위도 구간은 어느 범위인가요? (10° 단위)",
            [lat_band(lat10), lat_band(lat10 + 10), lat_band(max(0, lat10 - 10)), lat_band(lat10 + 20)],
            0,
            [
                "위도 10° 단위로 생각해보세요",
                f"적도에서 약 {abs_lat:.0f}° 떨어진 지점입니다",
                f"위도 범위: {lat_band(lat10)}",
            ],
        ),
        # Q7 — longitude 20° band
        q(
            "이 장소가 속하는 경도 구간은 어느 범위인가요? (20° 단위)",
            [lon_band(lon20), lon_band(lon20 + 20), lon_band(max(0, lon20 - 20)), lon_band(lon20 + 40)],
            0,
            [
                "경도 20° 단위로 생각해보세요",
                f"이 지역의 경도는 약 {ew}{abs_lon:.0f}°입니다",
                f"경도 범위: {lon_band(lon20)}",
            ],
        ),
        # Q8 — latitude 5° band
        q(
            "위도를 5° 단위로 더 좁히면 어느 범위에 해당하나요?",
            [lat_band(lat5, 5), lat_band(lat5 + 5, 5), lat_band(max(0, lat5 - 5), 5), lat_band(lat5 + 10, 5)],
            0,
            [
                "5° 단위로 더 좁혀보세요",
                f"위도는 약 {ns}{abs_lat:.1f}°입니다",
                f"위도 범위: {lat_band(lat5, 5)}",
            ],
        ),
        # Q9 — longitude 5° band
        q(
            "경도를 5° 단위로 더 좁히면 어느 범위에 해당하나요?",
            [lon_band(lon5, 5), lon_band(lon5 + 5, 5), lon_band(max(0, lon5 - 5), 5), lon_band(lon5 + 10, 5)],
            0,
            [
                "5° 단위로 더 좁혀보세요",
                f"경도는 약 {ew}{abs_lon:.1f}°입니다",
                f"경도 범위: {lon_band(lon5, 5)}",
            ],
        ),
        # Q10 — nearest 1° lat+lon
        q(
            "이 보물 위치를 가장 잘 나타내는 위도/경도 쌍은 무엇인가요?",
            [
                f"{ns}{lat1}°, {ew}{lon1}°",
                f"{ns}{lat1 + 2}°, {ew}{lon1 + 3}°",
                f"{ns}{max(0, lat1 - 3)}°, {ew}{max(0, lon1 - 2)}°",
                f"{ns}{lat1 + 4}°, {ew}{lon1 - 4}°",
            ],
            0,
            [
                f"위도 약 {ns}{abs_lat:.0f}°, 경도 약 {ew}{abs_lon:.0f}°입니다",
                f"위도 {ns}{lat1}°, 경도 {ew}{lon1}°에 해당합니다",
                f"정답: {ns}{lat1}°, {ew}{lon1}°",
            ],
        ),
    ]


def build_coordinate_clues(lat: float, lon: float, lang: str = "ko") -> list[str]:
    """Generate 10 progressive coordinate reveals.
    Q1 correct → vague range; Q10 correct → exact coordinates.
    Labels are localised to the user's language.
    """
    if lang == "en":
        lat_lbl, lon_lbl = "Lat", "Lon"
        victory_hdr = "🎯 Full coordinates revealed!"
    elif lang == "vi":
        lat_lbl, lon_lbl = "Vĩ độ", "Kinh độ"
        victory_hdr = "🎯 Tọa độ đầy đủ!"
    else:  # ko (default)
        lat_lbl, lon_lbl = "위도", "경도"
        victory_hdr = "🎯 전체 좌표 공개!"

    lat_sign = "+" if lat >= 0 else ""
    lon_sign = "+" if lon >= 0 else ""

    clues = []
    for i in range(1, 11):
        if i <= 2:
            clues.append(
                f"{lat_lbl}: {lat_sign}{int(lat)}°** 대\n"
                f"{lon_lbl}: {lon_sign}{int(lon)}°** 대"
            )
        elif i <= 4:
            clues.append(
                f"{lat_lbl}: {lat:.1f}**°\n"
                f"{lon_lbl}: {lon:.1f}**°"
            )
        elif i <= 6:
            clues.append(
                f"{lat_lbl}: {lat:.2f}**°\n"
                f"{lon_lbl}: {lon:.2f}**°"
            )
        elif i <= 8:
            clues.append(
                f"{lat_lbl}: {lat:.3f}**°\n"
                f"{lon_lbl}: {lon:.3f}**°"
            )
        elif i == 9:
            clues.append(
                f"{lat_lbl}: {lat:.5f}°\n"
                f"{lon_lbl}: {lon:.5f}°"
            )
        else:
            clues.append(
                f"{victory_hdr}\n"
                f"{lat_lbl}: {lat:.6f}\n"
                f"{lon_lbl}: {lon:.6f}"
            )
    return clues
