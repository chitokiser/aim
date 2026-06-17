"""GitHub activity tracker for Web3 projects."""
import logging
from collectors.base import BaseCollector, Opportunity
from services.whale_score import score_github, quick_score
from config import GITHUB_TOKEN, GITHUB_BASE

logger = logging.getLogger(__name__)

WATCHED_REPOS = [
    "ethereum/go-ethereum",
    "ethereum/solidity",
    "ethereum/execution-specs",
    "matter-labs/zksync-era",
    "OffchainLabs/nitro",
    "base-org/node",
    "solana-labs/solana",
    "anza-xyz/agave",
    "sui-foundation/sui",
    "aptos-labs/aptos-core",
    "monadlabs/monad",
    "NomicFoundation/hardhat",
    "foundry-rs/foundry",
    "gakonst/ethers-rs",
    "eigenfoundation/eigenlayer-contracts",
    "uniswap/v4-core",
    "aave/aave-v3-core",
]


class GitHubCollector(BaseCollector):
    category = "github"

    def _headers(self) -> dict:
        h = {"Accept": "application/vnd.github.v3+json", "User-Agent": "WhaleSignalX/1.0"}
        if GITHUB_TOKEN:
            h["Authorization"] = f"token {GITHUB_TOKEN}"
        return h

    async def collect(self) -> list[Opportunity]:
        opps = []
        for repo in WATCHED_REPOS:
            try:
                data = await self._get(f"{GITHUB_BASE}/repos/{repo}", headers=self._headers())
                if not data:
                    continue
                commits_data = await self._get(
                    f"{GITHUB_BASE}/repos/{repo}/commits",
                    headers=self._headers(),
                    params={"per_page": 30},
                )
                contributors_data = await self._get(
                    f"{GITHUB_BASE}/repos/{repo}/contributors",
                    headers=self._headers(),
                    params={"per_page": 10},
                )
                stars = data.get("stargazers_count", 0)
                forks = data.get("forks_count", 0)
                commit_count = len(commits_data) if isinstance(commits_data, list) else 0
                contributor_count = len(contributors_data) if isinstance(contributors_data, list) else 0
                commit_growth = min(commit_count * 10, 300)
                contributor_growth = min(contributor_count * 5, 200)
                score = score_github(commit_growth, contributor_growth)
                total_score = quick_score(50 + score, [10 if stars > 5000 else 0])
                if total_score < 60:
                    continue
                project_name = data.get("full_name", repo)
                opps.append(Opportunity(
                    category="github",
                    title=f"Dev Signal: {project_name} — {commit_count} recent commits",
                    summary=f"Stars: {stars:,}, Forks: {forks:,}, Contributors active: {contributor_count}",
                    source_url=data.get("html_url", f"https://github.com/{repo}"),
                    whale_score=total_score,
                    raw_data={
                        "project": project_name,
                        "commits": f"+{commit_count} (recent)",
                        "contributors": f"{contributor_count} active",
                        "stars": f"{stars:,}",
                        "activity": "High" if commit_count > 20 else "Medium",
                        "url": data.get("html_url", f"https://github.com/{repo}"),
                        "whale_score": total_score,
                    },
                ))
            except Exception as e:
                logger.error(f"GitHub tracker error {repo}: {e}")
        return opps
