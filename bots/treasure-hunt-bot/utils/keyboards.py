"""Reusable keyboard builders."""

from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from config import COMMUNITY_URL, JUMPWORLD_URL, HINT_COSTS
from utils.i18n import t


def lang_select_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("🇺🇸 English", callback_data="lang:en"),
            InlineKeyboardButton("🇰🇷 한국어", callback_data="lang:ko"),
            InlineKeyboardButton("🇻🇳 Tiếng Việt", callback_data="lang:vi"),
        ]
    ])


def main_menu_keyboard(lang: str = "ko") -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(t("btn_treasure_list", lang), callback_data="tl")],
        [InlineKeyboardButton(t("btn_jumpworld", lang), url=JUMPWORLD_URL)],
        [InlineKeyboardButton(t("btn_community", lang), url=COMMUNITY_URL)],
    ])


def treasure_list_keyboard(treasures: list, user_attempts: dict, lang: str = "ko") -> InlineKeyboardMarkup:
    buttons = []
    for tr in treasures:
        attempt = user_attempts.get(tr.id)
        if attempt and attempt.is_completed:
            icon = "✅"
        elif attempt:
            icon = "▶️"
        else:
            icon = "🆕"
        label = f"{icon} #{tr.id} — {tr.prize_gp:,} P"
        buttons.append([InlineKeyboardButton(label, callback_data=f"ti:{tr.id}")])

    buttons.append([InlineKeyboardButton(t("btn_main_menu", lang), callback_data="menu")])
    return InlineKeyboardMarkup(buttons)


def treasure_info_keyboard(treasure_id: int, has_attempt: bool, is_completed: bool, lang: str = "ko") -> InlineKeyboardMarkup:
    buttons = []
    if is_completed:
        buttons.append([InlineKeyboardButton(t("btn_completed", lang), callback_data="noop")])
    elif has_attempt:
        buttons.append([InlineKeyboardButton(t("btn_continue", lang), callback_data=f"ts:{treasure_id}")])
    else:
        buttons.append([InlineKeyboardButton(t("btn_start_challenge", lang), callback_data=f"ts:{treasure_id}")])
    buttons.append([InlineKeyboardButton(t("btn_back_list", lang), callback_data="tl")])
    buttons.append([InlineKeyboardButton(t("btn_jumpworld_visit", lang), url=JUMPWORLD_URL)])
    return InlineKeyboardMarkup(buttons)


def question_keyboard(
    treasure_id: int,
    order_num: int,
    purchased_hints: set[int],
    lang: str = "ko",
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
                    f"💡 Hint Lv{level} ({cost:,} P)" if lang == "en" else
                    f"💡 힌트 Lv{level} ({cost:,} P)" if lang == "ko" else
                    f"💡 Gợi ý Lv{level} ({cost:,} P)",
                    callback_data=f"nh:{tid}:{q}:{level}",
                )
            ])
    return InlineKeyboardMarkup(buttons)


def hint_confirm_keyboard(treasure_id: int, order_num: int, level: int, cost: int, lang: str = "ko") -> InlineKeyboardMarkup:
    if lang == "en":
        confirm_label = f"✅ Use {cost:,} P for hint"
        cancel_label = "❌ Cancel"
    elif lang == "vi":
        confirm_label = f"✅ Dùng {cost:,} P xem gợi ý"
        cancel_label = "❌ Hủy"
    else:
        confirm_label = f"✅ {cost:,} P 사용하고 힌트 보기"
        cancel_label = "❌ 취소"
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(confirm_label, callback_data=f"bh:{treasure_id}:{order_num}:{level}")],
        [InlineKeyboardButton(cancel_label, callback_data=f"nxt:{treasure_id}:{order_num}")],
    ])


def after_correct_keyboard(treasure_id: int, next_q: int, lang: str = "ko") -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(t("btn_next_question", lang), callback_data=f"nxt:{treasure_id}:{next_q}")]
    ])


def after_wrong_keyboard(treasure_id: int, order_num: int, lang: str = "ko") -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(t("btn_retry", lang), callback_data=f"nxt:{treasure_id}:{order_num}")]
    ])


def game_over_keyboard(lang: str = "ko") -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(t("btn_other_treasures", lang), callback_data="tl")],
        [InlineKeyboardButton(t("btn_jumpworld_visit", lang), url=JUMPWORLD_URL)],
    ])


def victory_keyboard(lat: float, lon: float, lang: str = "ko") -> InlineKeyboardMarkup:
    maps_url = f"https://maps.google.com/?q={lat},{lon}"
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(t("btn_google_maps", lang), url=maps_url)],
        [InlineKeyboardButton(t("btn_jumpworld_visit", lang), url=JUMPWORLD_URL)],
        [InlineKeyboardButton(t("btn_community", lang), url=COMMUNITY_URL)],
    ])
