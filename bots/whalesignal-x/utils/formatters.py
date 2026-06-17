from typing import Optional


def whale_score_badge(score: int) -> str:
    if score >= 95:
        return "🔴 LEGENDARY"
    elif score >= 85:
        return "🟠 EXCELLENT"
    elif score >= 75:
        return "🟡 STRONG"
    elif score >= 60:
        return "🟢 WATCHLIST"
    else:
        return "⚪ WEAK"


def format_funding(data: dict) -> str:
    score = data.get("whale_score", 0)
    return (
        f"🐋 *WHALE ALERT*\n\n"
        f"**Project:** {data.get('project', 'Unknown')}\n"
        f"**Funding:** ${data.get('amount', 'N/A')}\n"
        f"**Investor:** {data.get('investor', 'N/A')}\n"
        f"**Category:** {data.get('category', 'N/A')}\n"
        f"**Stage:** {data.get('stage', 'N/A')}\n"
        f"**WhaleScore:** {score} {whale_score_badge(score)}\n"
        f"\n📰 [원문 보기]({data.get('url', '#')})"
    )


def format_grant(data: dict) -> str:
    score = data.get("whale_score", 0)
    return (
        f"💰 *NEW GRANT*\n\n"
        f"**Network:** {data.get('network', 'N/A')}\n"
        f"**Budget:** {data.get('budget', 'N/A')}\n"
        f"**Target:** {data.get('target', 'N/A')}\n"
        f"**Deadline:** {data.get('deadline', 'N/A')}\n"
        f"**WhaleScore:** {score} {whale_score_badge(score)}\n"
        f"\n📰 [지원하기]({data.get('url', '#')})"
    )


def format_hackathon(data: dict) -> str:
    score = data.get("whale_score", 0)
    return (
        f"🏆 *HACKATHON ALERT*\n\n"
        f"**Name:** {data.get('name', 'Unknown')}\n"
        f"**Prize Pool:** {data.get('prize', 'N/A')}\n"
        f"**Registration:** {data.get('status', 'N/A')}\n"
        f"**Deadline:** {data.get('deadline', 'N/A')}\n"
        f"**Organizer:** {data.get('organizer', 'N/A')}\n"
        f"**WhaleScore:** {score} {whale_score_badge(score)}\n"
        f"\n📰 [참가 신청]({data.get('url', '#')})"
    )


def format_airdrop(data: dict) -> str:
    score = data.get("whale_score", 0)
    return (
        f"🎁 *AIRDROP ALERT*\n\n"
        f"**Project:** {data.get('project', 'Unknown')}\n"
        f"**Platform:** {data.get('platform', 'N/A')}\n"
        f"**Tasks:** {data.get('tasks', 'N/A')}\n"
        f"**Difficulty:** {data.get('difficulty', 'N/A')}\n"
        f"**Reward:** {data.get('reward', 'N/A')}\n"
        f"**WhaleScore:** {score} {whale_score_badge(score)}\n"
        f"\n📰 [참여하기]({data.get('url', '#')})"
    )


def format_testnet(data: dict) -> str:
    score = data.get("whale_score", 0)
    return (
        f"🧪 *TESTNET ALERT*\n\n"
        f"**Project:** {data.get('project', 'Unknown')}\n"
        f"**Reward Probability:** {data.get('reward_prob', 'N/A')}\n"
        f"**Competition:** {data.get('competition', 'N/A')}\n"
        f"**Status:** {data.get('status', 'N/A')}\n"
        f"**WhaleScore:** {score} {whale_score_badge(score)}\n"
        f"\n📰 [참여하기]({data.get('url', '#')})"
    )


def format_listing(data: dict) -> str:
    score = data.get("whale_score", 0)
    return (
        f"📈 *LISTING ALERT*\n\n"
        f"**Token:** {data.get('token', 'Unknown')}\n"
        f"**Exchange:** {data.get('exchange', 'N/A')}\n"
        f"**Date:** {data.get('date', 'N/A')}\n"
        f"**Potential Impact:** {data.get('impact', 'N/A')}\n"
        f"**WhaleScore:** {score} {whale_score_badge(score)}\n"
        f"\n📰 [자세히 보기]({data.get('url', '#')})"
    )


def format_smart_money(data: dict) -> str:
    score = data.get("whale_score", 0)
    return (
        f"🐳 *SMART MONEY*\n\n"
        f"**Token:** {data.get('token', 'Unknown')}\n"
        f"**Action:** {data.get('action', 'N/A')}\n"
        f"**Amount:** {data.get('amount', 'N/A')}\n"
        f"**Wallet Type:** {data.get('wallet_type', 'N/A')}\n"
        f"**WhaleScore:** {score} {whale_score_badge(score)}\n"
        f"\n📰 [온체인 확인]({data.get('url', '#')})"
    )


def format_github(data: dict) -> str:
    score = data.get("whale_score", 0)
    return (
        f"👨‍💻 *DEV SIGNAL*\n\n"
        f"**Project:** {data.get('project', 'Unknown')}\n"
        f"**Commits:** {data.get('commits', 'N/A')}\n"
        f"**Contributors:** {data.get('contributors', 'N/A')}\n"
        f"**Stars:** {data.get('stars', 'N/A')}\n"
        f"**Activity:** {data.get('activity', 'N/A')}\n"
        f"**WhaleScore:** {score} {whale_score_badge(score)}\n"
        f"\n📰 [GitHub 보기]({data.get('url', '#')})"
    )


def format_social(data: dict) -> str:
    score = data.get("whale_score", 0)
    return (
        f"🔥 *SOCIAL SURGE*\n\n"
        f"**Project:** {data.get('project', 'Unknown')}\n"
        f"**Platform:** {data.get('platform', 'N/A')}\n"
        f"**Growth:** {data.get('growth', 'N/A')}\n"
        f"**Followers:** {data.get('followers', 'N/A')}\n"
        f"**WhaleScore:** {score} {whale_score_badge(score)}\n"
        f"\n📰 [자세히 보기]({data.get('url', '#')})"
    )


def format_dao(data: dict) -> str:
    score = data.get("whale_score", 0)
    return (
        f"🏛 *DAO TREASURY*\n\n"
        f"**DAO:** {data.get('dao', 'Unknown')}\n"
        f"**Budget:** {data.get('budget', 'N/A')}\n"
        f"**Proposal:** {data.get('proposal', 'N/A')}\n"
        f"**Deadline:** {data.get('deadline', 'N/A')}\n"
        f"**WhaleScore:** {score} {whale_score_badge(score)}\n"
        f"\n📰 [제안 보기]({data.get('url', '#')})"
    )


def format_jobs(data: dict) -> str:
    score = data.get("whale_score", 0)
    return (
        f"💼 *HIRING SURGE*\n\n"
        f"**Company:** {data.get('company', 'Unknown')}\n"
        f"**Open Positions:** {data.get('positions', 'N/A')}\n"
        f"**Growth:** {data.get('growth', 'N/A')}\n"
        f"**Category:** {data.get('category', 'N/A')}\n"
        f"**WhaleScore:** {score} {whale_score_badge(score)}\n"
        f"\n📰 [채용 보기]({data.get('url', '#')})"
    )


def format_government(data: dict) -> str:
    score = data.get("whale_score", 0)
    return (
        f"🏦 *GOVERNMENT FUND*\n\n"
        f"**Country:** {data.get('country', 'Unknown')}\n"
        f"**Program:** {data.get('program', 'N/A')}\n"
        f"**Budget:** {data.get('budget', 'N/A')}\n"
        f"**Deadline:** {data.get('deadline', 'N/A')}\n"
        f"**WhaleScore:** {score} {whale_score_badge(score)}\n"
        f"\n📰 [신청하기]({data.get('url', '#')})"
    )


def format_hidden_gem(data: dict) -> str:
    score = data.get("whale_score", 0)
    return (
        f"💎 *HIDDEN GEM*\n\n"
        f"**Project:** {data.get('project', 'Unknown')}\n"
        f"**Visibility:** {data.get('visibility', 'Low')}\n"
        f"**Potential:** {data.get('potential', 'N/A')}\n"
        f"**Category:** {data.get('category', 'N/A')}\n"
        f"**WhaleScore:** {score} {whale_score_badge(score)}\n"
        f"\n📰 [자세히 보기]({data.get('url', '#')})"
    )


def format_ecosystem(category: str, data: dict) -> str:
    icons = {"gamefi": "🎮", "nft": "🖼", "depin": "📡", "rwa": "🏢", "etf": "📊"}
    labels = {
        "gamefi": "GAMEFI", "nft": "NFT", "depin": "DePIN",
        "rwa": "RWA", "etf": "ETF/INSTITUTIONAL",
    }
    icon = icons.get(category, "🔍")
    label = labels.get(category, category.upper())
    score = data.get("whale_score", 0)
    return (
        f"{icon} *{label} ALERT*\n\n"
        f"**Project:** {data.get('project', 'Unknown')}\n"
        f"**Signal:** {data.get('signal', 'N/A')}\n"
        f"**Details:** {data.get('details', 'N/A')}\n"
        f"**WhaleScore:** {score} {whale_score_badge(score)}\n"
        f"\n📰 [자세히 보기]({data.get('url', '#')})"
    )


def format_today_pick(data: dict) -> str:
    score = data.get("whale_score", 0)
    return (
        f"🎯 *TODAY'S TOP OPPORTUNITY*\n\n"
        f"**Project:** {data.get('project', 'Unknown')}\n"
        f"**Funding:** {data.get('funding', 'N/A')}\n"
        f"**Grant:** {data.get('grant', 'N/A')}\n"
        f"**Airdrop:** {data.get('airdrop', 'N/A')}\n"
        f"**Hiring:** {data.get('hiring', 'N/A')}\n"
        f"**WhaleScore:** {score} {whale_score_badge(score)}\n"
        f"**Recommendation:** {data.get('recommendation', 'RESEARCH PRIORITY')}\n"
        f"\n⚠️ _투자 권유가 아닌 리서치 우선순위 참고 정보입니다._"
    )


def format_opportunity_list(opps: list) -> str:
    if not opps:
        return "📭 현재 해당 카테고리의 최신 기회가 없습니다.\n\n잠시 후 다시 확인해주세요."
    lines = []
    for i, opp in enumerate(opps[:10], 1):
        score = opp.get("whale_score", 0)
        badge = whale_score_badge(score)
        lines.append(
            f"{i}. *{opp.get('title', 'Unknown')}*\n"
            f"   WhaleScore: {score} {badge}\n"
            f"   📅 {opp.get('created_at', '')[:10]}"
        )
    return "\n\n".join(lines)
