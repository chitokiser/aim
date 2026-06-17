from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from config import AI119_COMMUNITY_URL

AI119_BTN = InlineKeyboardButton("🤖 AI119 커뮤니티", url=AI119_COMMUNITY_URL)


def community_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([[AI119_BTN]])


def main_menu_keyboard() -> InlineKeyboardMarkup:
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
        [AI119_BTN],
    ])


def category_keyboard(category: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🔄 새로고침", callback_data=f"cmd_{category}")],
        [InlineKeyboardButton("🎯 Top 5", callback_data="cmd_top")],
        [InlineKeyboardButton("🏠 메인 메뉴", callback_data="cmd_menu")],
        [AI119_BTN],
    ])


def subscription_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("⭐ Pro - $9.99/월", callback_data="sub_pro")],
        [InlineKeyboardButton("👑 VIP - $29.99/월", callback_data="sub_vip")],
        [InlineKeyboardButton("📊 내 구독 현황", callback_data="sub_status")],
        [AI119_BTN],
    ])


def back_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🏠 메인 메뉴", callback_data="cmd_menu")],
        [AI119_BTN],
    ])


def pro_feature_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("⭐ Pro/VIP 업그레이드", callback_data="cmd_subscribe")],
        [AI119_BTN],
    ])
