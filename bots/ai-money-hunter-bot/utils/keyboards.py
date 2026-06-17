"""Reusable inline keyboards."""

from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from config import PARTNER_PLATFORM_URL, PARTNER_COMMUNITY_URL

PARTNER_BUTTONS = InlineKeyboardMarkup([
    [
        InlineKeyboardButton("🚀 AI119 플랫폼", url=PARTNER_PLATFORM_URL),
        InlineKeyboardButton("💬 AI119 커뮤니티", url=PARTNER_COMMUNITY_URL),
    ]
])


def with_partner(extra_rows: list[list[InlineKeyboardButton]] | None = None) -> InlineKeyboardMarkup:
    """Return partner buttons, optionally prepending extra rows."""
    rows = extra_rows or []
    rows.append([
        InlineKeyboardButton("🚀 AI119 플랫폼", url=PARTNER_PLATFORM_URL),
        InlineKeyboardButton("💬 AI119 커뮤니티", url=PARTNER_COMMUNITY_URL),
    ])
    return InlineKeyboardMarkup(rows)


def refresh_keyboard(callback: str) -> InlineKeyboardMarkup:
    return with_partner([[InlineKeyboardButton("🔄 새로고침", callback_data=callback)]])
