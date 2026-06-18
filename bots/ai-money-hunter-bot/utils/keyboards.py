"""Reusable inline keyboards."""

from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from config import PARTNER_PLATFORM_URL
from i18n import t


def with_partner(lang: str, extra_rows: list[list[InlineKeyboardButton]] | None = None) -> InlineKeyboardMarkup:
    """Return single AI119 site button, optionally prepending extra rows."""
    rows = list(extra_rows or [])
    rows.append([InlineKeyboardButton(t(lang, "btn_platform"), url=PARTNER_PLATFORM_URL)])
    return InlineKeyboardMarkup(rows)


def refresh_keyboard(callback: str, lang: str) -> InlineKeyboardMarkup:
    return with_partner(lang, [[InlineKeyboardButton(t(lang, "btn_refresh"), callback_data=callback)]])
