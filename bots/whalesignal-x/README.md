# 🐋 WhaleSignal X

> **Follow The Money** — AI가 전 세계 투자금, 그랜트, 에어드랍, 해커톤, 스마트머니를 실시간 추적하는 AI Opportunity Intelligence Platform

---

## Features

| Category | Source |
|----------|--------|
| 💰 Funding | RSS feeds + CryptoRank API |
| 💰 Grants | Ethereum, Arbitrum, Base, Optimism, Solana, Polygon |
| 🏆 Hackathons | DoraHacks, ETHGlobal, Devpost |
| 🎁 Airdrops | Galxe, Layer3, Zealy |
| 🧪 Testnets | Monad, MegaETH, EigenLayer |
| 📈 Listings | CoinGecko + RSS |
| 🐳 Smart Money | DeFiLlama TVL tracking |
| 👨‍💻 GitHub | Live repo activity (17+ top repos) |
| 🔥 Social | RSS sentiment |
| 🏛 DAO | Uniswap, Arbitrum, Compound treasury |
| 💼 Jobs | Coinbase, Uniswap Labs, a16z |
| 🏦 Gov Fund | Singapore, UAE, Korea, HK, Japan |
| 🎮 GameFi / 🖼 NFT / 📡 DePIN / 🏢 RWA / 📊 ETF | DeFiLlama + RSS |
| 💎 Hidden Gem | Claude AI analysis of trending + new coins |
| 📰 News Sentiment | Claude AI sentiment scoring |

## WhaleScore Algorithm (100pt)

| Signal | Max Points |
|--------|-----------|
| Funding Amount | 20 |
| VC Quality | 15 |
| GitHub Activity | 10 |
| Community Growth | 10 |
| Smart Money | 10 |
| Partnership | 10 |
| On-chain Growth | 10 |
| Hiring Signal | 5 |
| News Sentiment | 5 |
| Market Momentum | 5 |

Tiers: `95+ LEGENDARY` · `85+ EXCELLENT` · `75+ STRONG` · `60+ WATCHLIST`

## Subscription Plans

| Plan | Price | Features |
|------|-------|---------|
| Free | $0 | 20 queries/day |
| Pro | $9.99/mo | Unlimited + real-time alerts + Hidden Gem + daily AI brief |
| VIP | $29.99/mo | API + early signals (5min lead) + custom filters |

## Setup

```bash
cp .env.example .env
# Fill in WHALASIGNAL_BOT_TOKEN and ANTHROPIC_API_KEY

pip install -r requirements.txt
python bot.py
```

## Railway Deployment

```bash
railway login
railway init
railway variables set WHALASIGNAL_BOT_TOKEN=<token>
railway variables set ANTHROPIC_API_KEY=<key>
railway variables set ADMIN_IDS=<your_telegram_id>
railway up
```

## Commands

```
/start        — Welcome & main menu
/help         — Command list
/funding      — Investment rounds
/grants       — Grant programs
/hackathon    — Hackathons
/airdrop      — Airdrops
/testnet      — Testnets
/listings     — Exchange listings
/smartmoney   — Smart money (Pro)
/github       — Dev activity
/social       — Social surges
/dao          — DAO treasury
/jobs         — Hiring surge
/gov          — Government funds
/gamefi       — GameFi signals
/nft          — NFT signals
/depin        — DePIN signals
/rwa          — RWA signals
/etf          — ETF/institutional
/hidden       — Hidden gems (Pro)
/top          — Today's top 5
/calendar     — Today's calendar
/subscribe    — Plans & billing

/admin        — Admin panel
/stats        — Statistics
/broadcast    — Send to all users
/setpro <id>  — Grant Pro subscription
/setvip <id>  — Grant VIP subscription
```

---

Built for [[AI119]] — https://t.me/ai119
