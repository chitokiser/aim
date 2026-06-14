# AIM Platform - Development Guidelines

## Multilingual Requirement (CRITICAL)
All user-facing text MUST support 3 languages:
1. **English** (default/base)
2. **한국어** (Korean)
3. **Tiếng Việt** (Vietnamese)

This applies to:
- All frontend pages (Next.js)
- Telegram Mini App (telegram-miniapp/index.html)
- Telegram Bot messages (backend/src/bot/bot.service.ts)
- Error messages, toast notifications, labels, placeholders
- Section titles, descriptions, button text

Implementation approach: Use a language switcher component with localStorage persistence. Default to browser language detection (navigator.language).

---

## Business Sections

### Registration Flow
- Join Telegram group → Click Mini App → Auto-register
- Mentor code is mandatory (bot catches referral code from group join link → records mentor in DB → awards AP to referrer)
- If no mentor: auto-assign current admin as mentor

### Section 1 — SNS Content Marketing
Members upload their SNS content links (Facebook, YouTube, TikTok, Instagram, X).
Advertisers select ad format and request promotion.
Bot verifies clicks/impressions/comments/likes → deducts advertiser's AP (AimPoint).

### Section 2 — AI Product Review / CF Creation
Advertiser escrows AP and provides product links/images/videos.
Members create AI-generated review videos or CF ads and post to their SNS.
Platform bot verifies engagement metrics → auto-rewards member from advertiser budget.

### Section 3 — AI Music / Music Video Creation
Advertiser provides lyrics/theme → Members create AI MP3 and music videos matching the content.

### Section 4 — Business Content Contest
Client requests business intro, promo videos, posters, landing pages.
Members submit content → Other users vote/evaluate → Top 1–10 ranked creators auto-rewarded from advertiser budget.

### Section 5 — SNS Sponsorship Marketplace
Members register their SNS accounts and set monthly sponsorship packages.
Must specify: services offered (banner placement, posts, etc.) + monthly price.
Advertisers browse and hire SNS sponsors for 1-month contracts.

### Section 6 — Follow / Join Rewards
Advertisers set rewards for: Instagram follows, Telegram channel joins, group joins, YouTube subscriptions.
Members complete tasks → verified by bot → AP rewarded instantly.

---

## AP Economy
- AP (AimPoint): 10,000 AP = 1 USD
- Revenue split from advertiser's AP deposit:
  - Platform: 20%
  - Mentor: 10%
  - Marketer/Member: 70%
- AP top-up methods: Telegram STARS, TON, USDT

---

## Tech Stack
- Frontend: Next.js 15 (App Router), TypeScript, TailwindCSS v4, Shadcn UI
- Backend: NestJS, Firebase Firestore, JWT, Telegraf
- Telegram Mini App: Bootstrap 5, vanilla JS, Telegram WebApp SDK
- Use `@radix-ui/react-dropdown-menu` (NOT `@base-ui/react/menu`) for dropdown components
