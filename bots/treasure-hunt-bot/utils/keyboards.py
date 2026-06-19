"""Reusable keyboard builders."""

from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from config import COMMUNITY_URL, JUMPWORLD_URL, HINT_COSTS
from database import Question


def main_menu_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🗺 보물 목록 보기", callback_data="tl")],
        [InlineKeyboardButton("🏪 Jumpworld 보물찾으러 가기", url=JUMPWORLD_URL)],
        [InlineKeyboardButton("💬 AIM 커뮤니티", url=COMMUNITY_URL)],
    ])


def treasure_list_keyboard(treasures: list, user_attempts: dict) -> InlineKeyboardMarkup:
    """
    user_attempts: {treasure_id: attempt} — used to show status icons.
    """
    buttons = []
    for t in treasures:
        attempt = user_attempts.get(t.id)
        if attempt and attempt.is_completed:
            icon = "✅"
        elif attempt:
            icon = "▶️"
        else:
            icon = "🆕"
        label = f"{icon} 보물 #{t.id} — {t.prize_gp:,} GP"
        buttons.append([InlineKeyboardButton(label, callback_data=f"ti:{t.id}")])

    buttons.append([InlineKeyboardButton("🔙 메인 메뉴", callback_data="menu")])
    return InlineKeyboardMarkup(buttons)


def treasure_info_keyboard(treasure_id: int, has_attempt: bool, is_completed: bool) -> InlineKeyboardMarkup:
    buttons = []
    if is_completed:
        buttons.append([InlineKeyboardButton("✅ 완료됨", callback_data="noop")])
    elif has_attempt:
        buttons.append([InlineKeyboardButton("▶️ 이어서 도전", callback_data=f"ts:{treasure_id}")])
    else:
        buttons.append([InlineKeyboardButton("🎯 도전 시작!", callback_data=f"ts:{treasure_id}")])
    buttons.append([InlineKeyboardButton("📋 보물 목록", callback_data="tl")])
    buttons.append([InlineKeyboardButton("🏪 Jumpworld", url=JUMPWORLD_URL)])
    return InlineKeyboardMarkup(buttons)


def question_keyboard(
    treasure_id: int,
    order_num: int,
    purchased_hints: set[int],
) -> InlineKeyboardMarkup:
    tid = treasure_id
    q = order_num
    buttons = [
        [
            InlineKeyboardButton("A", callback_data=f"ans:{tid}:{q}:0"),
            InlineKeyboardButton("B", callback_data=f"ans:{tid}:{q}:1"),
            InlineKeyboardButton("C", callback_data=f"ans:{tid}:{q}:2"),
            InlineKeyboardButton("D", callback_data=f"ans:{tid}:{q}:3"),
        ]
    ]
    for level, cost in HINT_COSTS.items():
        if level not in purchased_hints:
            buttons.append([
                InlineKeyboardButton(
                    f"💡 힌트 Lv{level} ({cost:,} GP)",
                    callback_data=f"nh:{tid}:{q}:{level}",
                )
            ])
    return InlineKeyboardMarkup(buttons)


def hint_confirm_keyboard(treasure_id: int, order_num: int, level: int, cost: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton(
                f"✅ {cost:,} GP 사용하고 힌트 보기",
                callback_data=f"bh:{treasure_id}:{order_num}:{level}",
            )
        ],
        [
            InlineKeyboardButton(
                "❌ 취소",
                callback_data=f"nxt:{treasure_id}:{order_num}",
            )
        ],
    ])


def after_correct_keyboard(treasure_id: int, next_q: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("➡️ 다음 문제", callback_data=f"nxt:{treasure_id}:{next_q}")]
    ])


def after_wrong_keyboard(treasure_id: int, order_num: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🔄 다시 도전", callback_data=f"nxt:{treasure_id}:{order_num}")]
    ])


def game_over_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("📋 다른 보물 도전", callback_data="tl")],
        [InlineKeyboardButton("🏪 Jumpworld", url=JUMPWORLD_URL)],
    ])


def victory_keyboard(lat: float, lon: float) -> InlineKeyboardMarkup:
    maps_url = f"https://maps.google.com/?q={lat},{lon}"
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🌍 Google Maps에서 확인", url=maps_url)],
        [InlineKeyboardButton("🏪 Jumpworld 방문하기", url=JUMPWORLD_URL)],
        [InlineKeyboardButton("💬 AIM 커뮤니티", url=COMMUNITY_URL)],
    ])
