"""Reusable inline keyboards."""

from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from config import PARTNER_PLATFORM_URL, PARTNER_COMMUNITY_URL
from i18n import t


def with_partner(lang: str = "ko", extra_rows: list[list[InlineKeyboardButton]] | None = None) -> InlineKeyboardMarkup:
    """Return AI119 platform + community buttons, optionally prepending extra rows."""
    rows = list(extra_rows or [])
    rows.append([
        InlineKeyboardButton(t(lang, "btn_platform"), url=PARTNER_PLATFORM_URL),
        InlineKeyboardButton(t(lang, "btn_community"), url=PARTNER_COMMUNITY_URL),
    ])
    return InlineKeyboardMarkup(rows)


def refresh_keyboard(callback: str, lang: str = "ko") -> InlineKeyboardMarkup:
    return with_partner(lang, [[InlineKeyboardButton(t(lang, "btn_refresh"), callback_data=callback)]])
