from __future__ import annotations

from datetime import datetime, timezone

import pytz

from database import Match, User
from i18n import t

KST = pytz.timezone("Asia/Seoul")

ACHIEVEMENTS = [
    ("first_pred",  "🎯", "First Kick",       "첫 킥",         "Cú Đá Đầu",   lambda u: u.total_predicted >= 1),
    ("win_10",      "✅", "Sharp Bettor",      "날카로운 베터", "Người Đặt Cược Sắc Bén", lambda u: u.correct_predictions >= 10),
    ("win_50",      "🏆", "EPL Master",        "EPL 마스터",   "Bậc Thầy EPL",lambda u: u.correct_predictions >= 50),
    ("win_100",     "⭐", "AI119 Legend",      "AI119 전설",   "Huyền Thoại AI119", lambda u: u.correct_predictions >= 100),
    ("whale",       "🐳", "Football Whale",    "풋볼 고래",    "Cá Voi Bóng Đá", lambda u: u.total_ap_won >= 1_000_000),
    ("streak_3",    "🔥", "Hot Streak",        "연속 적중",    "Chuỗi Nóng",  lambda u: u.win_streak >= 3),
    ("daily_7",     "📅", "Weekly Warrior",    "주간 전사",    "Chiến Binh Tuần", lambda u: u.streak_days >= 7),
    ("daily_30",    "📆", "Loyal Fan",         "충성 팬",      "Fan Trung Thành", lambda u: u.streak_days >= 30),
]


def format_time(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(KST).strftime("%Y-%m-%d %H:%M")


def format_match_header(match: Match) -> str:
    return f"⚽ {match.home_team} vs {match.away_team}\n🏆 {match.league}\n🕐 {format_time(match.match_time)} KST"


def format_achievements(user: User, lang: str) -> str:
    earned = []
    for key, icon, en, ko, vi, cond in ACHIEVEMENTS:
        if cond(user):
            if lang == "ko":
                earned.append(f"{icon} {ko}")
            elif lang == "vi":
                earned.append(f"{icon} {vi}")
            else:
                earned.append(f"{icon} {en}")
    return "\n".join(earned) if earned else t(lang, "no_achievements")


def format_profile(user: User, lang: str) -> str:
    name = user.first_name or user.username or "User"
    rate = 0
    if user.total_predicted > 0:
        rate = round(user.correct_predictions / user.total_predicted * 100, 1)
    achievements = format_achievements(user, lang)
    return t(
        lang,
        "profile_body",
        name=name,
        balance=user.ap_balance,
        p_balance=user.p_balance,
        total=user.total_predicted,
        correct=user.correct_predictions,
        rate=rate,
        earned=user.total_ap_won,
        streak=user.streak_days,
        achievements=achievements,
    )


def get_value_label(lang: str, pred_type: str, pred_value: str) -> str:
    mapping: dict[str, dict[str, str]] = {
        "1x2": {"home": "val_home", "draw": "val_draw", "away": "val_away"},
        "btts": {"yes": "val_yes", "no": "val_no"},
        "ou": {"over": "val_over", "under": "val_under"},
        "first": {"home": "val_home_first", "away": "val_away_first"},
        "handicap": {"home": "val_home_hcp", "away": "val_away_hcp"},
    }
    if pred_type == "score":
        return pred_value
    key = mapping.get(pred_type, {}).get(pred_value, pred_value)
    return t(lang, key)


def get_type_label(lang: str, pred_type: str) -> str:
    type_key_map = {
        "1x2": "type_1x2",
        "score": "type_score",
        "btts": "type_btts",
        "ou": "type_ou",
        "first": "type_first",
        "handicap": "type_handicap",
    }
    return t(lang, type_key_map.get(pred_type, pred_type))
