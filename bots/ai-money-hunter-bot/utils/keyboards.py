"""Reusable inline keyboards."""

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from config import PARTNER_PLATFORM_URL, PARTNER_COMMUNITY_URL
from i18n import t


def with_partner(
    lang: str = "ko",
    extra_rows: list[list[InlineKeyboardButton]] | None = None,
    login_url: str | None = None,
) -> InlineKeyboardMarkup:
    """Return AI119 platform + community buttons, optionally prepending extra rows.

    When login_url is provided (private DM only), the platform button uses web_app
    so the user lands on the site already authenticated via the ?tg= JWT flow.
    """
    rows = list(extra_rows or [])
    if login_url:
        platform_btn = InlineKeyboardButton(t(lang, "btn_platform"), web_app=WebAppInfo(url=login_url))
    else:
        platform_btn = InlineKeyboardButton(t(lang, "btn_platform"), url=PARTNER_PLATFORM_URL)
    rows.append([
        platform_btn,
        InlineKeyboardButton(t(lang, "btn_community"), url=PARTNER_COMMUNITY_URL),
    ])
    return InlineKeyboardMarkup(rows)


def refresh_keyboard(callback: str, lang: str = "ko") -> InlineKeyboardMarkup:
    return with_partner(lang, [[InlineKeyboardButton(t(lang, "btn_refresh"), callback_data=callback)]])
