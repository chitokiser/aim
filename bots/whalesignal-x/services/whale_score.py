"""WhaleScore algorithm — 100-point opportunity scoring engine."""

WEIGHTS = {
    "funding_amount": 20,
    "vc_quality": 15,
    "github_activity": 10,
    "community_growth": 10,
    "smart_money": 10,
    "partnership": 10,
    "hiring": 5,
    "onchain_growth": 10,
    "news_sentiment": 5,
    "market_momentum": 5,
}

TIER_LABELS = {
    (95, 100): "🔴 LEGENDARY",
    (85, 94): "🟠 EXCELLENT",
    (75, 84): "🟡 STRONG",
    (60, 74): "🟢 WATCHLIST",
    (0, 59): "⚪ WEAK",
}


def get_tier(score: int) -> str:
    for (low, high), label in TIER_LABELS.items():
        if low <= score <= high:
            return label
    return "⚪ WEAK"


def score_funding(amount_usd: float) -> int:
    if amount_usd >= 50_000_000:
        return 20
    elif amount_usd >= 10_000_000:
        return 16
    elif amount_usd >= 1_000_000:
        return 12
    elif amount_usd >= 100_000:
        return 8
    return 4


def score_vc_quality(vc_name: str) -> int:
    top_vcs = {
        "a16z", "andreessen horowitz", "paradigm", "sequoia", "binance labs",
        "coinbase ventures", "multicoin", "polychain", "pantera", "dragonfly",
        "animoca", "spartan", "framework", "three arrows", "jump"
    }
    mid_vcs = {
        "blockchain capital", "digital currency group", "galaxy", "hack vc",
        "gsr", "delphi digital", "cms holdings"
    }
    name_lower = vc_name.lower()
    for vc in top_vcs:
        if vc in name_lower:
            return 15
    for vc in mid_vcs:
        if vc in name_lower:
            return 10
    return 5


def score_github(commit_growth_pct: float, contributor_growth_pct: float) -> int:
    score = 0
    if commit_growth_pct >= 200:
        score += 5
    elif commit_growth_pct >= 100:
        score += 4
    elif commit_growth_pct >= 50:
        score += 3
    else:
        score += 1
    if contributor_growth_pct >= 100:
        score += 5
    elif contributor_growth_pct >= 50:
        score += 3
    else:
        score += 1
    return min(score, 10)


def score_community(follower_growth_pct: float) -> int:
    if follower_growth_pct >= 200:
        return 10
    elif follower_growth_pct >= 100:
        return 8
    elif follower_growth_pct >= 50:
        return 6
    elif follower_growth_pct >= 20:
        return 4
    return 2


def score_smart_money(wallet_count: int, total_usd: float) -> int:
    score = 0
    if wallet_count >= 5:
        score += 5
    elif wallet_count >= 2:
        score += 3
    else:
        score += 1
    if total_usd >= 1_000_000:
        score += 5
    elif total_usd >= 100_000:
        score += 3
    else:
        score += 1
    return min(score, 10)


def score_onchain(tvl_growth_pct: float, active_wallets_growth_pct: float) -> int:
    score = 0
    if tvl_growth_pct >= 100:
        score += 5
    elif tvl_growth_pct >= 50:
        score += 3
    else:
        score += 1
    if active_wallets_growth_pct >= 100:
        score += 5
    elif active_wallets_growth_pct >= 50:
        score += 3
    else:
        score += 1
    return min(score, 10)


def score_news_sentiment(sentiment_score: float) -> int:
    if sentiment_score >= 80:
        return 5
    elif sentiment_score >= 60:
        return 4
    elif sentiment_score >= 40:
        return 2
    return 1


def calculate_whale_score(signals: dict) -> int:
    """
    signals: dict with optional keys:
      funding_usd, vc_name, commit_growth_pct, contributor_growth_pct,
      follower_growth_pct, smart_wallet_count, smart_money_usd,
      tvl_growth_pct, active_wallets_growth_pct, sentiment_score,
      has_partnership, has_hiring, has_smart_money
    """
    total = 0

    if "funding_usd" in signals:
        total += score_funding(signals["funding_usd"])
    if "vc_name" in signals:
        total += score_vc_quality(signals["vc_name"])
    if "commit_growth_pct" in signals or "contributor_growth_pct" in signals:
        total += score_github(
            signals.get("commit_growth_pct", 0),
            signals.get("contributor_growth_pct", 0),
        )
    if "follower_growth_pct" in signals:
        total += score_community(signals["follower_growth_pct"])
    if signals.get("has_smart_money"):
        total += score_smart_money(
            signals.get("smart_wallet_count", 1),
            signals.get("smart_money_usd", 0),
        )
    if signals.get("has_partnership"):
        total += 10
    if signals.get("has_hiring"):
        total += 5
    if "tvl_growth_pct" in signals or "active_wallets_growth_pct" in signals:
        total += score_onchain(
            signals.get("tvl_growth_pct", 0),
            signals.get("active_wallets_growth_pct", 0),
        )
    if "sentiment_score" in signals:
        total += score_news_sentiment(signals["sentiment_score"])

    return min(total, 100)


def quick_score(base: int, bonuses: list) -> int:
    """Quick scoring for collectors that don't have all signal data."""
    total = base + sum(bonuses)
    return min(max(total, 0), 100)
