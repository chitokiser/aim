from __future__ import annotations

from datetime import datetime, timezone

import pytz

from database import Match, Prediction, User
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


def format_bet_history(
    preds_with_matches: list[tuple[Prediction, Match]],
    user: User,
    lang: str,
) -> str:
    name = user.first_name or user.username or "User"
    rate = 0
    if user.total_predicted > 0:
        rate = round(user.correct_predictions / user.total_predicted * 100, 1)

    stats_line = t(
        lang,
        "bets_stats",
        total=user.total_predicted,
        correct=user.correct_predictions,
        rate=rate,
    )

    active: list[str] = []
    past: list[str] = []

    for pred, match in preds_with_matches:
        type_label = get_type_label(lang, pred.pred_type)
        value_label = get_value_label(lang, pred.pred_type, pred.pred_value)
        currency = pred.stake_currency.upper()
        match_line = f"⚽ {match.home_team} vs {match.away_team}"
        stake_line = f"{currency} {pred.stake_ap:,} → {currency} {pred.payout_ap:,}"
        pred_line = f"📊 {type_label}: *{value_label}*"

        if pred.status == "pending":
            time_str = format_time(match.match_time)
            active.append(
                f"• {match_line}\n  {pred_line}\n  💸 {stake_line}\n  🕐 {time_str}"
            )
        elif pred.status == "won":
            past.append(f"• ✅ {match_line} — {value_label} (+{pred.payout_ap:,} {currency})")
        elif pred.status == "lost":
            past.append(f"• ❌ {match_line} — {value_label} (−{pred.stake_ap:,} {currency})")
        elif pred.status == "cancelled":
            past.append(f"• 🚫 {match_line} — {value_label} (refunded)")

    parts: list[str] = [f"*{name}* — {t(lang, 'bets_title')}", "", stats_line, ""]

    if active:
        parts.append(t(lang, "bets_active"))
        parts.extend(active)
        parts.append("")

    if past:
        parts.append(t(lang, "bets_past"))
        parts.extend(past[:15])

    if not active and not past:
        parts.append(t(lang, "bets_empty"))

    return "\n".join(parts)


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
