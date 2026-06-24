from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from config import AIM_SITE_URL, AI119_COMMUNITY_URL, BOT_USERNAME
from i18n import t


def _site_btn(lang: str) -> InlineKeyboardButton:
    return InlineKeyboardButton(t(lang, "site_btn"), url=AIM_SITE_URL)


def _community_btn(lang: str) -> InlineKeyboardButton:
    return InlineKeyboardButton(t(lang, "community_btn"), url=AI119_COMMUNITY_URL)


def community_keyboard(lang: str = "en") -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([[_site_btn(lang), _community_btn(lang)]])


def main_menu_keyboard(lang: str = "en") -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("💰 Funding", callback_data="cmd_funding"),
            InlineKeyboardButton("🏆 Grant", callback_data="cmd_grants"),
        ],
        [
            InlineKeyboardButton("🎁 Airdrop", callback_data="cmd_airdrop"),
            InlineKeyboardButton("🧪 Testnet", callback_data="cmd_testnet"),
        ],
        [
            InlineKeyboardButton("🏆 Hackathon", callback_data="cmd_hackathon"),
            InlineKeyboardButton("📈 Listings", callback_data="cmd_listings"),
        ],
        [
            InlineKeyboardButton("🐳 Smart Money", callback_data="cmd_smartmoney"),
            InlineKeyboardButton("👨‍💻 GitHub", callback_data="cmd_github"),
        ],
        [
            InlineKeyboardButton("🔥 Social", callback_data="cmd_social"),
            InlineKeyboardButton("🏛 DAO", callback_data="cmd_dao"),
        ],
        [
            InlineKeyboardButton("💼 Jobs", callback_data="cmd_jobs"),
            InlineKeyboardButton("🏦 Gov Fund", callback_data="cmd_gov"),
        ],
        [
            InlineKeyboardButton("🎯 Top", callback_data="cmd_top"),
            InlineKeyboardButton("💎 Hidden Gem", callback_data="cmd_hidden"),
        ],
        [
            InlineKeyboardButton("📅 Calendar", callback_data="cmd_calendar"),
            InlineKeyboardButton("⭐ Pro/VIP", callback_data="cmd_subscribe"),
        ],
        [_site_btn(lang)],
    ])


def category_keyboard(category: str, lang: str = "en") -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(t(lang, "refresh_btn"), callback_data=f"cmd_{category}")],
        [InlineKeyboardButton(t(lang, "top5_btn"), callback_data="cmd_top")],
        [InlineKeyboardButton(t(lang, "main_menu_btn"), callback_data="cmd_menu")],
        [_site_btn(lang)],
    ])


def subscription_keyboard(lang: str = "en") -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(t(lang, "pro_monthly_btn"), callback_data="sub_pro")],
        [InlineKeyboardButton(t(lang, "vip_monthly_btn"), callback_data="sub_vip")],
        [InlineKeyboardButton(t(lang, "my_sub_btn"), callback_data="sub_status")],
        [_site_btn(lang)],
    ])


def back_keyboard(lang: str = "en") -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(t(lang, "main_menu_btn"), callback_data="cmd_menu")],
        [_site_btn(lang)],
    ])


def pro_feature_keyboard(lang: str = "en") -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(t(lang, "pro_upgrade_btn"), callback_data="cmd_subscribe")],
        [_site_btn(lang)],
    ])


def group_broadcast_keyboard(lang: str = "en") -> InlineKeyboardMarkup:
    """Group-safe keyboard: url buttons only (web_app is forbidden in groups)."""
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(t(lang, "get_analysis_btn"), url=f"https://t.me/{BOT_USERNAME}?start=group")],
        [_site_btn(lang)],
    ])
