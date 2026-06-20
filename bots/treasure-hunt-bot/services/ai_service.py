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
당신은 인문학적 보물찾기 퀴즈 제작자입니다.
GPS 좌표와 위치 정보를 기반으로, 해당 장소의 역사·문화·인물·예술·전통을 통해 장소를 좁혀가는 10개의 객관식 문제를 한국어로 생성하세요.
단, 좌표나 정확한 주소를 문제에 직접 포함해서는 안 됩니다.
순수한 지리/수학(위도·경도·반구·거리) 문제는 피하고, 반드시 인문학적 단서로 질문하세요.

문제 유형 가이드 (점진적으로 범위를 좁혀가세요):
- Q1~Q2: 문명권·종교·언어 (어느 문화권에 속하는가? 어떤 종교·언어가 지배적인가?)
- Q3~Q4: 역사적 사건·왕조·제국 (이 지역을 지배했던 왕조, 이곳과 관련된 역사적 사건)
- Q5~Q6: 유명 인물·문학·예술 (이 지역 출신의 역사적 인물, 작가, 예술가, 철학자)
- Q7~Q8: 생활 문화·음식·축제 (전통 음식, 지역 축제, 민속, 관습, 건축 양식)
- Q9~Q10: 구체적 현지 단서 (지역 특산물, 특정 랜드마크의 역사적 의미, 지역 고유의 이야기)

각 문제 형식:
- question: 인문학적 관점의 질문 (한국어, 마치 역사 또는 문화 퀴즈처럼)
- options: 정확히 4개의 선택지 배열 [A, B, C, D] (한국어, 그럴듯하지만 오답인 보기 포함)
- answer: 정답 인덱스 (0=A, 1=B, 2=C, 3=D)
- hints: 3개의 힌트 배열 [레벨1(매우 모호한 문화 단서), 레벨2(좀 더 구체적인 역사·문화 단서), 레벨3(거의 정답에 가까운 단서)]

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
    """Fallback questions when AI is unavailable. Culture/history-based, not coordinate math."""
    address = geo.get("address", {})
    country = address.get("country", "알 수 없음")
    state = address.get("state", address.get("province", ""))
    city = (
        address.get("city")
        or address.get("town")
        or address.get("village")
        or address.get("municipality")
        or ""
    )

    abs_lat = abs(lat)
    abs_lon = abs(lon)

    # Infer broad cultural/civilizational zone from coordinates
    # East Asia
    if 20 <= abs_lat <= 55 and 100 <= abs_lon <= 145 and lat >= 0:
        civ = "동아시아 문명권 (유교·불교 문화)"
        civ_wrongs = ["이슬람 문화권", "라틴 아메리카 문화권", "서유럽 문화권"]
        lang_family = "한국어·중국어·일본어 계열"
        lang_wrongs = ["인도유럽어족", "아프리카어족", "셈어족"]
        religion = "불교 또는 유교"
        rel_wrongs = ["이슬람교", "힌두교", "기독교"]
        food_q = "쌀을 주식으로 하고 발효 음식(김치·된장·미소 등)이 발달한 문화권은?"
        food_a = "동아시아"
        food_wrongs = ["중동", "남미", "북유럽"]
        arch = "목조 전통 건축과 기와지붕"
        arch_wrongs = ["돔 형태 모스크", "콜로세움식 원형 경기장", "고딕 성당"]
    # South/Southeast Asia
    elif 0 <= abs_lat <= 30 and 60 <= abs_lon <= 110 and lat >= 0:
        civ = "남아시아·동남아시아 문명권"
        civ_wrongs = ["동아시아 문명권", "서유럽 문명권", "아프리카 문명권"]
        lang_family = "드라비다어족·오스트로아시아어족"
        lang_wrongs = ["게르만어파", "로망스어파", "슬라브어파"]
        religion = "힌두교 또는 불교"
        rel_wrongs = ["기독교", "유대교", "신토"]
        food_q = "향신료와 열대 과일이 풍부하고, 카레 문화가 발달한 지역은?"
        food_a = "남아시아·동남아시아"
        food_wrongs = ["동유럽", "북아프리카", "스칸디나비아"]
        arch = "힌두 사원 또는 불탑 양식"
        arch_wrongs = ["한옥", "바로크 궁전", "이글루"]
    # Middle East / North Africa
    elif 15 <= abs_lat <= 40 and 25 <= abs_lon <= 60 and lat >= 0:
        civ = "이슬람·아랍 문명권"
        civ_wrongs = ["동아시아 문명권", "라틴 아메리카 문화권", "켈트 문화권"]
        lang_family = "셈어족 (아랍어·히브리어 등)"
        lang_wrongs = ["인도유럽어족", "한-티베트어족", "우랄어족"]
        religion = "이슬람교"
        rel_wrongs = ["불교", "힌두교", "신토"]
        food_q = "후무스, 팔라펠, 케밥 등이 일상 음식인 문화권은?"
        food_a = "중동·아랍 문화권"
        food_wrongs = ["동아시아", "스칸디나비아", "안데스 문화권"]
        arch = "돔과 미나렛(첨탑)이 특징인 이슬람 건축"
        arch_wrongs = ["파고다(불탑)", "고딕 성당", "조선 궁궐"]
    # Europe
    elif 35 <= abs_lat <= 70 and -10 <= abs_lon <= 40 and lat >= 0:
        civ = "서유럽·기독교 문명권"
        civ_wrongs = ["이슬람 문명권", "동아시아 유교 문화권", "힌두 문화권"]
        lang_family = "인도유럽어족 (게르만·로망스·슬라브어파)"
        lang_wrongs = ["셈어족", "한-티베트어족", "오스트로네시아어족"]
        religion = "기독교 (가톨릭·개신교)"
        rel_wrongs = ["이슬람교", "힌두교", "신토"]
        food_q = "빵·치즈·와인이 식문화의 중심을 이루는 문화권은?"
        food_a = "유럽"
        food_wrongs = ["동아시아", "동남아시아", "중동"]
        arch = "고딕 성당, 르네상스 궁전 등 석조 건축"
        arch_wrongs = ["목조 한옥", "이슬람 모스크", "마야 피라미드"]
    # Americas
    elif -55 <= lat <= 70 and -170 <= lon <= -30:
        civ = "아메리카 대륙 문화권"
        civ_wrongs = ["유럽 문명권", "동아시아 문명권", "이슬람 문명권"]
        lang_family = "영어·스페인어·포르투갈어 등 유럽 이주 언어"
        lang_wrongs = ["셈어족", "드라비다어족", "한-티베트어족"]
        religion = "기독교 (주류)"
        rel_wrongs = ["이슬람교", "힌두교", "신토"]
        food_q = "옥수수·감자·토마토를 전 세계에 전파한 대륙은?"
        food_a = "아메리카"
        food_wrongs = ["유럽", "아시아", "아프리카"]
        arch = "원주민 유적지 또는 유럽 식민지 시대 건축"
        arch_wrongs = ["이슬람 모스크", "동아시아 목조 건축", "인도 힌두 사원"]
    # Africa (sub-Saharan)
    elif lat < 15 and -20 <= lon <= 55:
        civ = "사하라 이남 아프리카 문화권"
        civ_wrongs = ["유럽 문명권", "동아시아 문명권", "이슬람 아랍 문화권"]
        lang_family = "반투어족·닐로사하라어족 등"
        lang_wrongs = ["인도유럽어족", "셈어족", "한-티베트어족"]
        religion = "기독교 또는 토착 신앙"
        rel_wrongs = ["힌두교", "신토", "유대교"]
        food_q = "얌·수수·카사바 등 뿌리채소가 주식인 문화권은?"
        food_a = "사하라 이남 아프리카"
        food_wrongs = ["동아시아", "남미", "북유럽"]
        arch = "전통 흙집(어도비) 또는 원형 주거 양식"
        arch_wrongs = ["고딕 성당", "목조 한옥", "이슬람 돔"]
    # Default / Pacific / other
    else:
        civ = "태평양·오세아니아 문화권"
        civ_wrongs = ["유럽 문명권", "이슬람 문명권", "동아시아 문명권"]
        lang_family = "오스트로네시아어족"
        lang_wrongs = ["인도유럽어족", "셈어족", "한-티베트어족"]
        religion = "기독교 (식민지 유입) 또는 토착 신앙"
        rel_wrongs = ["이슬람교", "힌두교", "유대교"]
        food_q = "해산물·코코넛·타로가 주식인 도서 문화권은?"
        food_a = "태평양·오세아니아"
        food_wrongs = ["동유럽", "중동", "동아시아"]
        arch = "전통 폴리네시아·멜라네시아 양식"
        arch_wrongs = ["이슬람 모스크", "고딕 성당", "동아시아 목조 건축"]

    def q(question, options, answer, hints):
        return {"question": question, "options": options, "answer": answer, "hints": hints}

    country_display = country if country != "알 수 없음" else "미확인 지역"

    return [
        # Q1 — civilizational zone
        q(
            "이 보물이 숨겨진 장소는 어느 문명권·문화권에 속하나요?",
            [civ] + civ_wrongs,
            0,
            [
                "이 지역의 종교·언어·역사를 떠올려보세요",
                "수천 년간 이 지역을 지배한 문화적 흐름을 생각해보세요",
                f"이 장소는 {civ}에 속합니다",
            ],
        ),
        # Q2 — language family
        q(
            "이 지역에서 주로 사용되는 언어는 어느 어족·어파에 속하나요?",
            [lang_family] + lang_wrongs,
            0,
            [
                "이 지역의 역사적 지배 민족과 문화를 생각해보세요",
                "언어와 문명의 흐름은 함께 움직입니다",
                f"이 지역의 주요 언어: {lang_family}",
            ],
        ),
        # Q3 — religion
        q(
            "이 지역에서 역사적으로 가장 큰 영향을 끼친 종교는 무엇인가요?",
            [religion] + rel_wrongs,
            0,
            [
                "이 지역의 전통 문화와 건축 양식에서 힌트를 얻을 수 있습니다",
                "역사적 정복과 교역로가 종교 전파에 영향을 주었습니다",
                f"이 지역의 주요 종교: {religion}",
            ],
        ),
        # Q4 — country
        q(
            f"이 보물이 위치한 나라는 어디인가요?",
            [country_display,
             "브라질" if country_display not in ("브라질",) else "아르헨티나",
             "인도" if country_display not in ("인도",) else "파키스탄",
             "나이지리아" if country_display not in ("나이지리아",) else "에티오피아"],
            0,
            [
                "이 나라가 속한 대륙의 문화를 먼저 떠올려보세요",
                f"나라 이름의 첫 글자: '{country_display[0]}'",
                f"정답: {country_display}",
            ],
        ),
        # Q5 — food culture
        q(
            food_q,
            [food_a] + food_wrongs,
            0,
            [
                "그 지역의 자연환경이 식재료를 결정합니다",
                "역사적 교역과 농경 문화를 생각해보세요",
                f"정답: {food_a}",
            ],
        ),
        # Q6 — architecture
        q(
            "이 지역의 전통 건축 양식으로 가장 잘 알려진 것은 무엇인가요?",
            [arch] + arch_wrongs,
            0,
            [
                "건축 양식은 종교와 기후의 영향을 받습니다",
                "이 지역의 전통 종교와 지배 문명을 떠올려보세요",
                f"이 지역의 건축: {arch}",
            ],
        ),
        # Q7 — state/province (if available)
        q(
            f"이 보물이 있는 지역(주/도/광역)은 어디인가요?",
            [state or "확인 중",
             "관동 지방" if state != "관동 지방" else "관서 지방",
             "파리 일드프랑스" if state != "파리 일드프랑스" else "노르망디",
             "캘리포니아" if state != "캘리포니아" else "텍사스"],
            0,
            [
                "이 지역의 역사적 명칭을 생각해보세요",
                f"나라 '{country_display}' 내의 한 지방입니다",
                f"정답: {state or country_display}",
            ],
        ),
        # Q8 — city (if available)
        q(
            "이 보물이 숨겨진 도시 또는 마을로 가장 유명한 것은?",
            [city or country_display,
             "교토" if city not in ("교토",) else "오사카",
             "피렌체" if city not in ("피렌체",) else "베네치아",
             "마라케시" if city not in ("마라케시",) else "카사블랑카"],
            0,
            [
                "이 도시의 역사적 별명이나 별칭을 생각해보세요",
                f"이 도시는 {state or country_display}에 위치합니다",
                f"정답: {city or country_display}",
            ],
        ),
        # Q9 — historical era
        q(
            "이 지역의 역사에서 가장 큰 전환점이 된 사건이나 시대는 무엇인가요?",
            [
                "20세기 독립운동 및 근대화",
                "중세 봉건 시대의 쇠퇴",
                "고대 그리스·로마 시대",
                "신석기 농경 혁명",
            ],
            0,
            [
                "이 지역이 근대에 어떻게 변화했는지 생각해보세요",
                "식민지 경험 또는 혁명의 역사가 있나요?",
                "20세기 역사가 이 지역에 결정적 영향을 미쳤습니다",
            ],
        ),
        # Q10 — humanistic final clue
        q(
            f"'{country_display}'를 대표하는 문화유산이나 세계적으로 알려진 특징은 무엇인가요?",
            [
                f"{country_display}의 고유한 전통과 세계문화유산",
                "지중해 요리와 올리브 문화",
                "북유럽 바이킹 유산",
                "안데스 잉카 문명 유적",
            ],
            0,
            [
                "이 나라가 유네스코 세계문화유산으로 등재한 것을 생각해보세요",
                f"'{country_display}'만의 독특한 문화·예술·음식이 있습니다",
                f"정답: {country_display}의 고유 문화유산",
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
