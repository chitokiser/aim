from __future__ import annotations

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo

from config import MULTIPLIERS, SITE_URL, COMMUNITY_URL
from i18n import t


def main_menu(lang: str, login_url: str | None = None) -> InlineKeyboardMarkup:
    platform_btn = (
        InlineKeyboardButton(t(lang, "btn_platform"), web_app=WebAppInfo(url=login_url))
        if login_url
        else InlineKeyboardButton(t(lang, "btn_platform"), url=SITE_URL)
    )
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton(t(lang, "btn_daily"), callback_data="cmd:daily"),
            InlineKeyboardButton(t(lang, "btn_predict"), callback_data="cmd:predict"),
        ],
        [
            InlineKeyboardButton(t(lang, "btn_ranking"), callback_data="cmd:ranking"),
            InlineKeyboardButton(t(lang, "btn_profile"), callback_data="cmd:profile"),
        ],
        [platform_btn],
        [
            InlineKeyboardButton(t(lang, "btn_community"), url=COMMUNITY_URL),
        ],
    ])


def match_list(matches: list, lang: str) -> InlineKeyboardMarkup:
    import pytz
    from datetime import timezone

    tz = pytz.timezone("Asia/Seoul")
    rows = []
    for m in matches:
        if m.match_time.tzinfo is None:
            utc_time = m.match_time.replace(tzinfo=timezone.utc)
        else:
            utc_time = m.match_time
        local_time = utc_time.astimezone(tz)
        label = f"⚽ {m.home_team} vs {m.away_team} — {local_time.strftime('%m/%d %H:%M')}"
        rows.append([InlineKeyboardButton(label, callback_data=f"m:{m.id}")])
    rows.append([InlineKeyboardButton(t(lang, "btn_community"), url=COMMUNITY_URL)])
    return InlineKeyboardMarkup(rows)


def prediction_types(match_id: int, lang: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton(t(lang, "type_1x2"), callback_data=f"pt:{match_id}:1x2"),
            InlineKeyboardButton(t(lang, "type_btts"), callback_data=f"pt:{match_id}:btts"),
        ],
        [
            InlineKeyboardButton(t(lang, "type_ou"), callback_data=f"pt:{match_id}:ou"),
            InlineKeyboardButton(t(lang, "type_first"), callback_data=f"pt:{match_id}:first"),
        ],
        [
            InlineKeyboardButton(t(lang, "type_handicap"), callback_data=f"pt:{match_id}:handicap"),
            InlineKeyboardButton(t(lang, "btn_score_input"), callback_data=f"pt:{match_id}:score"),
        ],
        [InlineKeyboardButton(t(lang, "btn_analysis"), callback_data=f"analysis:{match_id}")],
        [InlineKeyboardButton(t(lang, "btn_back"), callback_data="cmd:predict")],
    ])


def pred_1x2(match_id: int, lang: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton(t(lang, "btn_home"), callback_data=f"pv:{match_id}:1x2:home"),
            InlineKeyboardButton(t(lang, "btn_draw"), callback_data=f"pv:{match_id}:1x2:draw"),
            InlineKeyboardButton(t(lang, "btn_away"), callback_data=f"pv:{match_id}:1x2:away"),
        ],
        [InlineKeyboardButton(t(lang, "btn_back"), callback_data=f"m:{match_id}")],
    ])


def pred_btts(match_id: int, lang: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton(t(lang, "btn_yes"), callback_data=f"pv:{match_id}:btts:yes"),
            InlineKeyboardButton(t(lang, "btn_no"), callback_data=f"pv:{match_id}:btts:no"),
        ],
        [InlineKeyboardButton(t(lang, "btn_back"), callback_data=f"m:{match_id}")],
    ])


def pred_ou(match_id: int, lang: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton(t(lang, "btn_over"), callback_data=f"pv:{match_id}:ou:over"),
            InlineKeyboardButton(t(lang, "btn_under"), callback_data=f"pv:{match_id}:ou:under"),
        ],
        [InlineKeyboardButton(t(lang, "btn_back"), callback_data=f"m:{match_id}")],
    ])


def pred_first(match_id: int, lang: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton(t(lang, "btn_first_home"), callback_data=f"pv:{match_id}:first:home"),
            InlineKeyboardButton(t(lang, "btn_first_away"), callback_data=f"pv:{match_id}:first:away"),
        ],
        [InlineKeyboardButton(t(lang, "btn_back"), callback_data=f"m:{match_id}")],
    ])


def pred_handicap(match_id: int, lang: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton(t(lang, "btn_handicap_home"), callback_data=f"pv:{match_id}:handicap:home"),
            InlineKeyboardButton(t(lang, "btn_handicap_away"), callback_data=f"pv:{match_id}:handicap:away"),
        ],
        [InlineKeyboardButton(t(lang, "btn_back"), callback_data=f"m:{match_id}")],
    ])


def currency_selector(
    match_id: int,
    pred_type: str,
    pred_value: str,
    lang: str,
    ap_balance: int,
    p_balance: int,
) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(
            t(lang, "btn_bet_ap", ap=ap_balance),
            callback_data=f"curr:{match_id}:{pred_type}:{pred_value}:ap",
        )],
        [InlineKeyboardButton(
            t(lang, "btn_bet_p", p=p_balance),
            callback_data=f"curr:{match_id}:{pred_type}:{pred_value}:p",
        )],
        [InlineKeyboardButton(t(lang, "btn_back"), callback_data=f"m:{match_id}")],
    ])


def stake_options(
    match_id: int,
    pred_type: str,
    pred_value: str,
    lang: str,
    balance: int,
    currency: str = "ap",
) -> InlineKeyboardMarkup:
    mult = MULTIPLIERS.get(pred_type, 1.9)
    amounts = [500, 1_000, 5_000, 10_000, 50_000]
    unit = "P" if currency == "p" else "AP"
    # Filter amounts user can afford
    affordable = [a for a in amounts if a <= balance]
    if not affordable:
        affordable = amounts[:1]  # Always show at least one option

    rows = []
    row: list[InlineKeyboardButton] = []
    for amount in affordable:
        payout = int(amount * mult)
        label = f"{amount:,} {unit} → {payout:,}"
        cb = f"stake:{match_id}:{pred_type}:{pred_value}:{amount}:{currency}"
        row.append(InlineKeyboardButton(label, callback_data=cb))
        if len(row) == 2:
            rows.append(row)
            row = []
    if row:
        rows.append(row)

    rows.append([InlineKeyboardButton(t(lang, "btn_cancel"), callback_data=f"m:{match_id}")])
    return InlineKeyboardMarkup(rows)


def confirm_bet(
    match_id: int,
    pred_type: str,
    pred_value: str,
    stake: int,
    lang: str,
    currency: str = "ap",
) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton(
                t(lang, "btn_confirm"),
                callback_data=f"confirm:{match_id}:{pred_type}:{pred_value}:{stake}:{currency}",
            ),
            InlineKeyboardButton(t(lang, "btn_cancel"), callback_data=f"m:{match_id}"),
        ]
    ])
