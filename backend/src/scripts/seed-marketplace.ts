/**
 * Seed script: populates Firestore `listings` collection with test data.
 * Run: npx ts-node -r dotenv/config src/scripts/seed-marketplace.ts
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const projectId = process.env.FIREBASE_PROJECT_ID!;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL!;
const privateKey = process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error('Missing Firebase env vars. Check backend/.env');
  process.exit(1);
}

if (getApps().length === 0) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const db = getFirestore();
const COLLECTION = 'listings';

function isoDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

const seedData = [
  // ── BOT (10) ──────────────────────────────────────────────────────────────
  {
    category: 'bot',
    title: 'AI Study Buddy Bot',
    description: 'Daily vocabulary quizzes and grammar lessons for English learners. Supports TOEIC / IELTS prep with spaced-repetition flashcards.',
    link: 'https://t.me/ai_study_buddy_bot',
    logoUrl: 'https://api.dicebear.com/9.x/bottts/svg?seed=study',
    tags: ['education', 'english', 'ai'],
    members: null,
    isFeatured: true,
    daysAgo: 1,
  },
  {
    category: 'bot',
    title: 'CryptoAlert Pro Bot',
    description: 'Real-time price alerts for BTC, ETH, SOL and 500+ altcoins. Set custom triggers and receive instant Telegram notifications.',
    link: 'https://t.me/crypto_alert_pro_bot',
    logoUrl: 'https://api.dicebear.com/9.x/bottts/svg?seed=crypto',
    tags: ['crypto', 'finance', 'alerts'],
    members: null,
    isFeatured: false,
    daysAgo: 2,
  },
  {
    category: 'bot',
    title: 'Daily News Digest Bot',
    description: 'Curated AI-summarized news delivered every morning. Choose your topics: tech, business, sports, entertainment.',
    link: 'https://t.me/daily_news_digest_bot',
    logoUrl: 'https://api.dicebear.com/9.x/bottts/svg?seed=news',
    tags: ['news', 'ai', 'daily'],
    members: null,
    isFeatured: false,
    daysAgo: 3,
  },
  {
    category: 'bot',
    title: 'Fitness Coach Bot',
    description: 'Personalised workout plans and macro tracking. Connects with Google Fit. Sends daily reminders and tracks your weekly progress.',
    link: 'https://t.me/fitness_coach_ai_bot',
    logoUrl: 'https://api.dicebear.com/9.x/bottts/svg?seed=fitness',
    tags: ['health', 'fitness', 'ai'],
    members: null,
    isFeatured: false,
    daysAgo: 4,
  },
  {
    category: 'bot',
    title: 'Resume Builder Bot',
    description: 'Generate a professional PDF resume in minutes. Supports 12 templates. ATS-optimised formatting included.',
    link: 'https://t.me/resume_builder_pro_bot',
    logoUrl: 'https://api.dicebear.com/9.x/bottts/svg?seed=resume',
    tags: ['career', 'ai', 'pdf'],
    members: null,
    isFeatured: false,
    daysAgo: 5,
  },
  {
    category: 'bot',
    title: 'Recipe Finder Bot',
    description: 'Snap a photo of your fridge and get instant recipe suggestions. Dietary filters: vegan, keto, gluten-free.',
    link: 'https://t.me/recipe_finder_ai_bot',
    logoUrl: 'https://api.dicebear.com/9.x/bottts/svg?seed=recipe',
    tags: ['food', 'ai', 'lifestyle'],
    members: null,
    isFeatured: false,
    daysAgo: 6,
  },
  {
    category: 'bot',
    title: 'Language Translator Bot',
    description: 'Instant translation across 100+ languages powered by GPT-4. Supports voice messages and document uploads.',
    link: 'https://t.me/lang_translator_ai_bot',
    logoUrl: 'https://api.dicebear.com/9.x/bottts/svg?seed=translate',
    tags: ['translation', 'language', 'ai'],
    members: null,
    isFeatured: false,
    daysAgo: 7,
  },
  {
    category: 'bot',
    title: 'Stock Screener Bot',
    description: 'Scan global stocks with 50+ technical indicators. Set filter criteria and receive daily picks every morning.',
    link: 'https://t.me/stock_screener_pro_bot',
    logoUrl: 'https://api.dicebear.com/9.x/bottts/svg?seed=stock',
    tags: ['stocks', 'finance', 'trading'],
    members: null,
    isFeatured: false,
    daysAgo: 8,
  },
  {
    category: 'bot',
    title: 'Meditation Guide Bot',
    description: 'Guided breathing, sleep stories, and 5-minute mindfulness sessions. 30-day calm challenge included.',
    link: 'https://t.me/meditation_guide_bot',
    logoUrl: 'https://api.dicebear.com/9.x/bottts/svg?seed=meditate',
    tags: ['health', 'mindfulness', 'wellness'],
    members: null,
    isFeatured: false,
    daysAgo: 9,
  },
  {
    category: 'bot',
    title: 'Code Review Bot',
    description: 'Paste a code snippet and receive AI-powered code review with suggestions for bugs, performance, and style.',
    link: 'https://t.me/code_review_ai_bot',
    logoUrl: 'https://api.dicebear.com/9.x/bottts/svg?seed=code',
    tags: ['developer', 'ai', 'coding'],
    members: null,
    isFeatured: false,
    daysAgo: 10,
  },

  // ── MINIAPP (10) ─────────────────────────────────────────────────────────
  {
    category: 'miniapp',
    title: 'AI119 Rewards Hub',
    description: 'Complete daily missions, earn AP points, and redeem exclusive rewards. Leaderboard updated every hour.',
    link: 'https://t.me/ai_bootcamp_hub_bot/AI119',
    logoUrl: 'https://api.dicebear.com/9.x/shapes/svg?seed=AI119',
    tags: ['rewards', 'gamification', 'ap'],
    members: null,
    isFeatured: true,
    daysAgo: 1,
  },
  {
    category: 'miniapp',
    title: 'TON Wallet Lite',
    description: 'Send and receive TON & USDT directly inside Telegram. Zero gas fees for first 30 days.',
    link: 'https://t.me/ton_wallet_lite_bot/app',
    logoUrl: 'https://api.dicebear.com/9.x/shapes/svg?seed=ton',
    tags: ['crypto', 'wallet', 'ton'],
    members: null,
    isFeatured: false,
    daysAgo: 2,
  },
  {
    category: 'miniapp',
    title: 'Quick Poll App',
    description: 'Create beautiful polls and surveys in seconds. Share results in groups with animated charts.',
    link: 'https://t.me/quick_poll_bot/app',
    logoUrl: 'https://api.dicebear.com/9.x/shapes/svg?seed=poll',
    tags: ['polls', 'community', 'tools'],
    members: null,
    isFeatured: false,
    daysAgo: 3,
  },
  {
    category: 'miniapp',
    title: 'Event Ticket Store',
    description: 'Buy and sell event tickets securely with crypto payments. QR-code entry included.',
    link: 'https://t.me/event_ticket_store_bot/app',
    logoUrl: 'https://api.dicebear.com/9.x/shapes/svg?seed=ticket',
    tags: ['events', 'tickets', 'crypto'],
    members: null,
    isFeatured: false,
    daysAgo: 4,
  },
  {
    category: 'miniapp',
    title: 'Freelance Board',
    description: 'Post or find short-term gigs paid in TON. Escrow-protected contracts with 5-star reviews.',
    link: 'https://t.me/freelance_board_bot/app',
    logoUrl: 'https://api.dicebear.com/9.x/shapes/svg?seed=freelance',
    tags: ['freelance', 'jobs', 'ton'],
    members: null,
    isFeatured: false,
    daysAgo: 5,
  },
  {
    category: 'miniapp',
    title: 'AI Image Studio',
    description: 'Generate stunning images from text prompts using Stable Diffusion. 20 free credits on signup.',
    link: 'https://t.me/ai_image_studio_bot/app',
    logoUrl: 'https://api.dicebear.com/9.x/shapes/svg?seed=image',
    tags: ['ai', 'image', 'creative'],
    members: null,
    isFeatured: false,
    daysAgo: 6,
  },
  {
    category: 'miniapp',
    title: 'Group Analytics Dashboard',
    description: 'Track growth, engagement, and top contributors for your Telegram group. Export to CSV.',
    link: 'https://t.me/group_analytics_bot/app',
    logoUrl: 'https://api.dicebear.com/9.x/shapes/svg?seed=analytics',
    tags: ['analytics', 'admin', 'groups'],
    members: null,
    isFeatured: false,
    daysAgo: 7,
  },
  {
    category: 'miniapp',
    title: 'Flashcard Maker',
    description: 'Create, study, and share flashcard decks. Spaced-repetition algorithm maximises your retention.',
    link: 'https://t.me/flashcard_maker_bot/app',
    logoUrl: 'https://api.dicebear.com/9.x/shapes/svg?seed=flashcard',
    tags: ['education', 'study', 'learning'],
    members: null,
    isFeatured: false,
    daysAgo: 8,
  },
  {
    category: 'miniapp',
    title: 'NFT Showcase',
    description: 'Display your NFT collection and list items for sale. TON-native marketplace with zero platform fee.',
    link: 'https://t.me/nft_showcase_bot/app',
    logoUrl: 'https://api.dicebear.com/9.x/shapes/svg?seed=nft',
    tags: ['nft', 'crypto', 'marketplace'],
    members: null,
    isFeatured: false,
    daysAgo: 9,
  },
  {
    category: 'miniapp',
    title: 'Habit Tracker',
    description: 'Build good habits with daily streaks, reminders, and a community accountability partner feature.',
    link: 'https://t.me/habit_tracker_bot/app',
    logoUrl: 'https://api.dicebear.com/9.x/shapes/svg?seed=habit',
    tags: ['productivity', 'habits', 'wellness'],
    members: null,
    isFeatured: false,
    daysAgo: 10,
  },

  // ── GROUP (10) ────────────────────────────────────────────────────────────
  {
    category: 'group',
    title: 'AI Bootcamp Community',
    description: 'Official AI119 community group. Share projects, ask questions, and connect with 5,000+ AI learners worldwide.',
    link: 'https://t.me/ai_bootcamp_community',
    logoUrl: 'https://api.dicebear.com/9.x/identicon/svg?seed=aibootcamp',
    tags: ['ai', 'community', 'learning'],
    members: 5200,
    isFeatured: true,
    daysAgo: 1,
  },
  {
    category: 'group',
    title: 'Crypto Traders Asia',
    description: 'Active spot and futures trading discussion for Asian market hours. Free signals Monday–Friday.',
    link: 'https://t.me/crypto_traders_asia',
    logoUrl: 'https://api.dicebear.com/9.x/identicon/svg?seed=cta',
    tags: ['crypto', 'trading', 'asia'],
    members: 12400,
    isFeatured: false,
    daysAgo: 2,
  },
  {
    category: 'group',
    title: 'Remote Work Hub',
    description: 'Job listings, productivity tips, and co-working sessions for remote professionals across 40+ countries.',
    link: 'https://t.me/remote_work_hub_global',
    logoUrl: 'https://api.dicebear.com/9.x/identicon/svg?seed=remote',
    tags: ['remote', 'jobs', 'productivity'],
    members: 8700,
    isFeatured: false,
    daysAgo: 3,
  },
  {
    category: 'group',
    title: 'Web3 Developers Club',
    description: 'Daily discussions on Solidity, TON, Move, and Rust smart contracts. Weekly code challenges with TON prizes.',
    link: 'https://t.me/web3_dev_club',
    logoUrl: 'https://api.dicebear.com/9.x/identicon/svg?seed=web3dev',
    tags: ['web3', 'developer', 'blockchain'],
    members: 3100,
    isFeatured: false,
    daysAgo: 4,
  },
  {
    category: 'group',
    title: 'Digital Marketing Masters',
    description: 'Strategies for SEO, paid ads, social media, and content marketing. Weekly AMAs with industry experts.',
    link: 'https://t.me/digital_marketing_masters',
    logoUrl: 'https://api.dicebear.com/9.x/identicon/svg?seed=dmm',
    tags: ['marketing', 'seo', 'ads'],
    members: 6300,
    isFeatured: false,
    daysAgo: 5,
  },
  {
    category: 'group',
    title: 'Startup Founders Network',
    description: 'Connect with early-stage founders, share pitch decks for feedback, and find co-founders or investors.',
    link: 'https://t.me/startup_founders_network',
    logoUrl: 'https://api.dicebear.com/9.x/identicon/svg?seed=startup',
    tags: ['startup', 'founders', 'investment'],
    members: 2800,
    isFeatured: false,
    daysAgo: 6,
  },
  {
    category: 'group',
    title: 'Korean Language Exchange',
    description: '한국어 학습 커뮤니티. Native Korean speakers help learners, beginners to advanced welcome.',
    link: 'https://t.me/korean_language_exchange',
    logoUrl: 'https://api.dicebear.com/9.x/identicon/svg?seed=korean',
    tags: ['language', 'korean', 'education'],
    members: 4500,
    isFeatured: false,
    daysAgo: 7,
  },
  {
    category: 'group',
    title: 'Photography & AI Art',
    description: 'Share your photos and AI-generated artwork. Monthly competitions with cash prizes.',
    link: 'https://t.me/photo_ai_art_club',
    logoUrl: 'https://api.dicebear.com/9.x/identicon/svg?seed=photo',
    tags: ['art', 'photography', 'ai'],
    members: 7200,
    isFeatured: false,
    daysAgo: 8,
  },
  {
    category: 'group',
    title: 'Health & Biohacking',
    description: 'Evidence-based discussions on longevity, nutrition, sleep optimisation, and wearable tech.',
    link: 'https://t.me/health_biohacking_group',
    logoUrl: 'https://api.dicebear.com/9.x/identicon/svg?seed=biohack',
    tags: ['health', 'biohacking', 'wellness'],
    members: 3900,
    isFeatured: false,
    daysAgo: 9,
  },
  {
    category: 'group',
    title: 'E-commerce Growth Hacks',
    description: 'Tips for Shopify, Amazon FBA, TikTok Shop, and cross-border e-commerce. Beginner-friendly.',
    link: 'https://t.me/ecommerce_growth_hacks',
    logoUrl: 'https://api.dicebear.com/9.x/identicon/svg?seed=ecom',
    tags: ['ecommerce', 'shopify', 'amazon'],
    members: 9100,
    isFeatured: false,
    daysAgo: 10,
  },

  // ── CHANNEL (10) ──────────────────────────────────────────────────────────
  {
    category: 'channel',
    title: 'AI119 Official Announcements',
    description: 'Official AI119 platform updates, new feature releases, and AP airdrop announcements.',
    link: 'https://t.me/aim_official_channel',
    logoUrl: 'https://api.dicebear.com/9.x/rings/svg?seed=aim_official',
    tags: ['official', 'announcements', 'AI119'],
    members: 15000,
    isFeatured: true,
    daysAgo: 1,
  },
  {
    category: 'channel',
    title: 'AI Tools Daily',
    description: 'One AI tool reviewed every day. No fluff — just honest ratings on usability, pricing, and ROI.',
    link: 'https://t.me/ai_tools_daily',
    logoUrl: 'https://api.dicebear.com/9.x/rings/svg?seed=aitools',
    tags: ['ai', 'tools', 'review'],
    members: 22000,
    isFeatured: false,
    daysAgo: 2,
  },
  {
    category: 'channel',
    title: 'Crypto Alpha Calls',
    description: 'Early-entry signals for altcoins before major listings. Track record published monthly.',
    link: 'https://t.me/crypto_alpha_calls',
    logoUrl: 'https://api.dicebear.com/9.x/rings/svg?seed=alpha',
    tags: ['crypto', 'signals', 'trading'],
    members: 18500,
    isFeatured: false,
    daysAgo: 3,
  },
  {
    category: 'channel',
    title: 'Tech Jobs Weekly',
    description: 'Hand-picked remote tech jobs posted every Monday. Focus on senior roles paying $100K+.',
    link: 'https://t.me/tech_jobs_weekly',
    logoUrl: 'https://api.dicebear.com/9.x/rings/svg?seed=jobs',
    tags: ['jobs', 'tech', 'remote'],
    members: 31000,
    isFeatured: false,
    daysAgo: 4,
  },
  {
    category: 'channel',
    title: 'Design Inspiration Feed',
    description: 'Daily UI/UX inspiration, Figma templates, and design system resources. Curated by a senior product designer.',
    link: 'https://t.me/design_inspiration_feed',
    logoUrl: 'https://api.dicebear.com/9.x/rings/svg?seed=design',
    tags: ['design', 'ui', 'figma'],
    members: 14200,
    isFeatured: false,
    daysAgo: 5,
  },
  {
    category: 'channel',
    title: 'Prompt Engineering Lab',
    description: 'Advanced prompts for Claude, GPT, and Gemini. Includes chain-of-thought, RAG, and agent prompts.',
    link: 'https://t.me/prompt_engineering_lab',
    logoUrl: 'https://api.dicebear.com/9.x/rings/svg?seed=prompt',
    tags: ['ai', 'prompts', 'llm'],
    members: 9800,
    isFeatured: false,
    daysAgo: 6,
  },
  {
    category: 'channel',
    title: 'Vietnam Startup Scene',
    description: 'Tin tức khởi nghiệp Việt Nam — funding rounds, events, and founder interviews in Vietnamese.',
    link: 'https://t.me/vietnam_startup_scene',
    logoUrl: 'https://api.dicebear.com/9.x/rings/svg?seed=vnstartup',
    tags: ['startup', 'vietnam', 'business'],
    members: 7600,
    isFeatured: false,
    daysAgo: 7,
  },
  {
    category: 'channel',
    title: 'No-Code Builder Tips',
    description: 'Bubble, Webflow, Make, and Zapier tutorials. Build SaaS without writing a single line of code.',
    link: 'https://t.me/nocode_builder_tips',
    logoUrl: 'https://api.dicebear.com/9.x/rings/svg?seed=nocode',
    tags: ['nocode', 'saas', 'automation'],
    members: 11300,
    isFeatured: false,
    daysAgo: 8,
  },
  {
    category: 'channel',
    title: 'Personal Finance Asia',
    description: 'Investment strategies, tax tips, and retirement planning tailored for Southeast Asian markets.',
    link: 'https://t.me/personal_finance_asia',
    logoUrl: 'https://api.dicebear.com/9.x/rings/svg?seed=finance',
    tags: ['finance', 'investment', 'asia'],
    members: 19700,
    isFeatured: false,
    daysAgo: 9,
  },
  {
    category: 'channel',
    title: 'Meme & Trend Radar',
    description: 'Spot viral content 24 hours before it blows up. Daily curation of Twitter/TikTok/Reddit trends.',
    link: 'https://t.me/meme_trend_radar',
    logoUrl: 'https://api.dicebear.com/9.x/rings/svg?seed=meme',
    tags: ['memes', 'trends', 'viral'],
    members: 42000,
    isFeatured: false,
    daysAgo: 10,
  },
];

async function seed() {
  console.log(`Seeding ${seedData.length} listings into Firestore...`);

  const batch = db.batch();
  const col = db.collection(COLLECTION);

  for (const item of seedData) {
    const { daysAgo, ...rest } = item;
    const ref = col.doc();
    batch.set(ref, {
      ...rest,
      userId: 'seed_admin',
      displayName: 'AI119 Seed',
      telegramId: '0',
      status: 'active',
      createdAt: isoDate(daysAgo),
      ...(rest.isFeatured ? { featuredAt: isoDate(daysAgo), featuredApPaid: 10000 } : {}),
    });
  }

  await batch.commit();
  console.log(`Done! ${seedData.length} listings written.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
