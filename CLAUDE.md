# AIM Platform - Development Guidelines

## Code Language (CRITICAL)
- All code, variable names, function names, type names, and comments MUST be written in **English**.
- Do NOT write code, comments, or identifiers in Korean or Vietnamese.
- Korean/Vietnamese appear ONLY in user-facing string values (UI text, bot messages, translations).

## Multilingual Requirement (CRITICAL)
All user-facing text MUST support 3 languages, with **English as the default**:
1. **English** (default — all messages and UI text start in English)
2. **한국어** (Korean)
3. **Tiếng Việt** (Vietnamese)

This applies to:
- All frontend pages (Next.js)
- Telegram Mini App (telegram-miniapp/index.html)
- Telegram Bot messages (backend/src/bots/main-bot/main-bot.service.ts)
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

## API Key & Secret Management (CRITICAL)

**Never expose secrets in code or commits.**

### Rules
- All API keys, tokens, and credentials MUST live in `.env` files only — never hardcoded in source files
- `.env`, `.env.local`, `.env.production` are listed in `.gitignore` — **never remove them from gitignore**
- Before every commit, verify no secret values appear in staged files (`git diff --cached`)
- Never commit files named `.env*` (except `.env.example` with placeholder values only)

### Key files that hold secrets (never commit these)
- `backend/.env` — Firebase credentials, JWT secret, Telegram bot token
- `frontend/.env.local` — Firebase client config, API base URL

### If a secret is accidentally committed
1. Immediately rotate/revoke the exposed key from its provider (Firebase console, Telegram BotFather, etc.)
2. Remove the secret from git history: `git filter-repo` or contact GitHub support
3. Force-push the cleaned history (coordinate with team first)

### .env.example pattern
Keep `backend/.env.example` and `frontend/.env.example` with dummy placeholder values so other developers know which keys are required — never put real values in these files.

---

## SEO Requirements

Every frontend page MUST include proper SEO metadata. This is not optional.

### Global (layout.tsx)
- `metadataBase`: set to production URL (`https://ai119.netlify.app`)
- `title`: descriptive, under 60 characters
- `description`: 120–160 characters, includes primary keywords
- `verification.google`: keep the Google Search Console verification tag — never remove it
- `openGraph`: title, description, url, siteName, type, images (use real image, not favicon)
- `twitter`: card type `summary_large_image`, title, description, image
- `robots`: `{ index: true, follow: true }` on public pages

### Per-page metadata
Each page should export its own `metadata` or `generateMetadata()` with a unique title and description. Format: `"Page Name — AI119"`.

### Additional SEO practices
- Use semantic HTML: `<h1>` once per page, `<h2>`/`<h3>` for structure
- All `<img>` tags must have descriptive `alt` text
- Use Next.js `<Link>` for internal navigation (not `<a href>`)
- Avoid client-only rendering for content that should be indexed — prefer server components for landing page sections
- Add `sitemap.xml` and `robots.txt` under `frontend/public/` if not already present

---

## Tech Stack
- Frontend: Next.js 15 (App Router), TypeScript, TailwindCSS v4, Shadcn UI
- Backend: NestJS, Firebase Firestore, JWT, Telegraf
- Telegram Mini App: Bootstrap 5, vanilla JS, Telegram WebApp SDK
- Use `@radix-ui/react-dropdown-menu` (NOT `@base-ui/react/menu`) for dropdown components

---

## Known Pitfalls & Required Practices (CRITICAL — learned from production bugs)

### 1. Button `asChild` is NOT supported (Netlify build killer)

The `Button` component in `frontend/src/components/ui/button.tsx` is based on `@base-ui/react/button`, which does **not** support the `asChild` prop. Using it causes a TypeScript error that blocks the **entire** Netlify build silently — the old code keeps serving and no frontend changes go live.

**Wrong:**
```tsx
<Button asChild><a href="...">Visit</a></Button>
```

**Correct — use `buttonVariants()` directly on the `<a>` tag:**
```tsx
import { buttonVariants } from "@/components/ui/button";
<a href="..." className={buttonVariants({ size: "sm", variant: "outline" })}>Visit</a>
```

### 2. TypeScript must be clean before every commit

A single TypeScript error in any frontend file silently kills the Netlify build. The site keeps serving the last successful build — making it look like code changes aren't deploying when actually the build failed.

**Before every commit, run:**
```bash
cd frontend && npx tsc --noEmit
```
Exit code must be `0`. Fix all errors before committing.

**If Netlify seems stuck on old code:** check the Netlify Deploys tab at https://app.netlify.com/projects/ai119/overview — a red failed build means zero frontend changes are live.

### 3. TelegramAutoLogin must ALWAYS run when `?tg=` is present

`frontend/src/components/telegram-auto-login.tsx` must exchange the `?tg=<JWT>` token unconditionally — even if the user already has a Google session in localStorage.

**Never add an early-return guard like:**
```tsx
if (user) return;  // WRONG — blocks bot login for Google-logged-in users
```

The correct flow:
1. Bot sends `/login` → user taps button → opens `https://ai119.netlify.app?tg=<jwt>`
2. `TelegramAutoLogin` reads `?tg=`, calls `GET /api/auth/bot-token?token=...`
3. Response sets the Telegram session, overriding any existing Google session
4. URL is cleaned (removes `?tg=` param) without page reload

After Telegram login, the user can logout and then use Google login separately.

### 4. Telegram bot button types: `web_app` vs `url`

| Context | Button type | Why |
|---------|-------------|-----|
| Private chat with bot | `web_app: { url: '...' }` | Opens URL inline, no confirmation dialog |
| Group messages | `url: 'https://t.me/bot?start=...'` | `web_app` is not supported in groups |

**Never use `web_app` in group keyboards** — it silently fails or is rejected by Telegram.

### 5. Netlify build debugging checklist

If user reports login/page not working after a code push:
1. Open https://app.netlify.com/projects/ai119/overview → Deploys tab
2. If latest deploy shows red/failed: find the build log, fix the error, push again
3. Common culprits: TypeScript errors, `asChild` on `@base-ui` components, missing `<Suspense>` around `useSearchParams()`
4. `useSearchParams()` requires `<Suspense>` wrapper in `output: "export"` mode (already done in `layout.tsx` — do not remove it)

---

## Telegram Bot Architecture (CRITICAL — read before adding any bot)

All bots live under `backend/src/bots/`. Never place bot files at the module root.

```
backend/src/bots/
  base/
    base-telegraf-bot.service.ts   ← abstract class all bots extend
  main-bot/
    main-bot.module.ts
    main-bot.service.ts            ← main user bot (@TELEGRAM_BOT_TOKEN)
  reward-bot/
    reward-bot.module.ts
    reward-bot.service.ts          ← advertiser group tracker (@REWARD_BOT_TOKEN)
  <new-bot>/                       ← next bot goes here
    <new-bot>.module.ts
    <new-bot>.service.ts
```

### Pattern for every new bot

1. Create `backend/src/bots/<new-bot>/` with a module and service file.
2. Service extends `BaseTelegrafBotService` from `../base/base-telegraf-bot.service`.
3. Implement **exactly two abstract methods**:
   - `getBotToken(): string | undefined` — reads from `process.env.NEW_BOT_TOKEN` or `ConfigService`
   - `registerHandlers(): void` — attaches all `this.bot.on/command/action` listeners
4. Add the token to `backend/.env` (never hardcode) and to `backend/.env.example` with a placeholder.
5. Register `<NewBot>Module` in `backend/src/app.module.ts`.

### Bot token env vars (never commit actual values)
| Bot | `.env` key | BotFather name |
|-----|------------|----------------|
| Main user bot | `TELEGRAM_BOT_TOKEN` | @ai_bootcamp_hub_bot (or equivalent) |
| Advertiser group tracker | `REWARD_BOT_TOKEN` | @ai119_reward_bot |

### Minimal boilerplate for a new bot

```typescript
// bots/<new-bot>/<new-bot>.service.ts
import { Injectable } from '@nestjs/common';
import { BaseTelegrafBotService } from '../base/base-telegraf-bot.service';

@Injectable()
export class NewBotService extends BaseTelegrafBotService {
  protected getBotToken() { return process.env.NEW_BOT_TOKEN; }

  protected registerHandlers() {
    if (!this.bot) return;
    this.bot.command('start', async (ctx) => { /* ... */ });
  }
}
```

```typescript
// bots/<new-bot>/<new-bot>.module.ts
import { Module } from '@nestjs/common';
import { NewBotService } from './<new-bot>.service';

@Module({ providers: [NewBotService] })
export class NewBotModule {}
```

### Railway deployment — adding a new bot token
After creating the bot, add its token to Railway environment variables:
`railway variables set NEW_BOT_TOKEN=<token>` (or via the Railway dashboard).

---

## Railway Deployment Map (CRITICAL — read before deploying any bot)

All bots deploy to the **`ai119-bot`** Railway project (project ID: `b848e338-3996-499f-a00c-20552a80bddc`). Each bot is a separate **service** within that project.

### Service → Directory mapping

| Railway Service Name | Service ID | Local Directory | Status |
|---|---|---|---|
| `ai-money-hunter-bot` | `c6997810-ab00-401d-bd04-6c3d9a166ca2` | `bots/ai-money-hunter-bot/` | deployed |
| `football-bot` | `65d9d6e8-dbe9-4958-b938-a7909589b17a` | `bots/football-predictor/` | deployed |
| `treasure-hunt-bot` | `2bb9da20-4302-4731-9851-5ea3778f021c` | `bots/treasure-hunt-bot/` | deployed |
| `ai119-bot` | `e8b90957-f2b0-4e48-ac07-c322e87f006c` | `backend/` (NestJS) | deployed |

> **CRITICAL:** `ai119-bot` is the **NestJS backend**, NOT the AI Money Hunter Bot. Never `railway up` from a bot directory while linked to `ai119-bot`.

> **Service link is auto-fixed:** Each bot directory has a `.railway/config.json` that hard-codes the correct `serviceId`. The Railway CLI reads this automatically — `railway status` must confirm the correct service before any deploy.

### Deployment checklist for each bot

**Step 1 — Navigate to the bot's directory:**
```powershell
cd bots/<bot-name>/
```

**Step 2 — Verify `.railway/config.json` exists (it should — it's committed).**
If missing, re-link manually (run once):
```powershell
railway service "<service-name>"
# ai-money-hunter-bot → "ai-money-hunter-bot"
# football-predictor  → "football-bot"
```

**Step 3 — Verify linkage (MANDATORY before every deploy):**
```powershell
railway status
# Must show: Service: <exact-service-name>  ← stop if wrong!
```

**Step 4 — Deploy:**
```powershell
railway up --detach
```

**Step 5 — Set env vars (first deploy only, or when adding new keys):**
```powershell
Get-Content .env | Where-Object { $_ -match '^\s*\w+\s*=' -and $_ -notmatch '^\s*#' } | ForEach-Object { railway variables set "$_" }
```

### Required files in every Python bot directory

- `Procfile` → `worker: python bot.py`
- `railway.json` → see below

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "builder": "NIXPACKS" },
  "deploy": {
    "startCommand": "python bot.py",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

---

## Mandatory Bot Requirements (CRITICAL — applies to ALL bots in this project)

Every bot developed in this project — whether NestJS (Telegraf) or Python (python-telegram-bot) — MUST include both of the following features without exception.

### 1. Community group link button

Every bot's `/start` response MUST include an inline button that links to the AIM community group:

```
https://t.me/ai119
```

**NestJS / Telegraf example:**
```typescript
ctx.reply('Welcome!', {
  reply_markup: {
    inline_keyboard: [[
      { text: '💬 Join AIM Community', url: 'https://t.me/ai119' },
    ]],
  },
});
```

**Python / python-telegram-bot example:**
```python
from telegram import InlineKeyboardButton, InlineKeyboardMarkup

keyboard = [[InlineKeyboardButton("💬 Join AIM Community", url="https://t.me/ai119")]]
await update.message.reply_text("Welcome!", reply_markup=InlineKeyboardMarkup(keyboard))
```

### 2. Telegram auto-login

Every bot that interacts with users in private DMs MUST implement the `?tg=<jwt>` auto-login flow so users land on `https://ai119.netlify.app` already authenticated.

**Flow:**
1. User sends `/start` (or `/login`) in private DM
2. Bot generates a signed JWT via `POST /api/auth/create-bot-token` (or directly via `JwtService`)
3. Bot sends a `web_app` button (private DMs only — never in groups):
   ```
   web_app: { url: 'https://ai119.netlify.app?tg=<jwt>' }
   ```
4. Frontend `TelegramAutoLogin` component (`frontend/src/components/telegram-auto-login.tsx`) reads `?tg=`, calls `GET /api/auth/bot-token?token=<jwt>`, and sets the session automatically

**Button type rules (recap from pitfalls §4):**
- Private chat → `web_app: { url: '...' }` — opens inline, no confirmation
- Group messages → `url: 'https://t.me/ai119?start=login'` — `web_app` is forbidden in groups

**NestJS example (full `/start` private DM handler):**
```typescript
const loginToken = this.authService.createBotLoginToken(user);
const SITE = 'https://ai119.netlify.app';
ctx.reply('Welcome to AIM!', {
  reply_markup: {
    inline_keyboard: [[
      { text: '🚀 Enter AIM Platform', web_app: { url: `${SITE}?tg=${loginToken}` } },
      { text: '💬 Join AIM Community', url: 'https://t.me/ai119' },
    ]],
  },
});
```

Both buttons MUST appear together — the login button and the community group button — on every `/start` response in private DMs.

---

## Python Bot — APScheduler Pattern (CRITICAL — prevents bot from dying)

### Root cause of "bot keeps dying"

Using `AsyncIOScheduler` from APScheduler **before** `app.run_polling()` causes an event loop conflict:

```python
# WRONG — scheduler binds to the wrong event loop
scheduler = setup_scheduler(app.bot)
scheduler.start()
app.run_polling(...)  # creates its OWN event loop via asyncio.run()
```

`app.run_polling()` internally calls `asyncio.run()`, creating a new event loop. The scheduler was started on a different (or non-running) loop, so when scheduled jobs fire, they raise `RuntimeError: Event loop is closed` and crash the bot.

### Correct pattern — always start scheduler inside `post_init`

```python
async def post_init(app: Application):
    await init_db()
    scheduler = setup_scheduler(app.bot)
    scheduler.start()
    app.bot_data["scheduler"] = scheduler   # store for graceful shutdown

async def post_shutdown(app: Application):
    scheduler = app.bot_data.get("scheduler")
    if scheduler and scheduler.running:
        scheduler.shutdown(wait=False)

def main():
    app = (
        Application.builder()
        .token(BOT_TOKEN)
        .post_init(post_init)
        .post_shutdown(post_shutdown)   # ← required for clean exit
        .build()
    )
    # Do NOT call scheduler.start() here
    app.run_polling(drop_pending_updates=True)
```

`post_init` runs inside the event loop that `run_polling` manages, so the scheduler and telegram handlers share the same loop. This is the **only** correct way to use APScheduler with python-telegram-bot v20+.

### Railway deployment files for Python bots

Every Python bot under `bots/` needs both:
- `Procfile` → `worker: python bot.py`
- `railway.json` → `{ "deploy": { "startCommand": "python bot.py", "restartPolicyType": "ON_FAILURE" } }`

Deploy to the existing `ai119-bot` Railway project as a new service:
```bash
cd bots/<bot-name>
railway up --service "<bot-name>" --detach
# Then set env vars:
Get-Content .env | Where-Object { $_ -match '=' } | ForEach-Object { railway variables set "$_" --service "<bot-name>" }
```
