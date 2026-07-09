/**
 * One-off / repeatable seeder: collects real headlines for a webzine category
 * from Google News RSS and has Claude write one distinct draft article per
 * headline (unlike the live scheduler, which writes a single article per
 * run) — useful for quickly populating a category with N test articles to
 * review the admin/public webzine UI without waiting on the 6h cron gate.
 *
 * Run: npx ts-node -r dotenv/config src/scripts/seed-webzine-articles.ts <category> <count>
 * Example: npx ts-node -r dotenv/config src/scripts/seed-webzine-articles.ts politics 10
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';
import Parser from 'rss-parser';
import { generateText, extractJSON, hasAiProvider, type AiKeys } from '../common/ai-text.util';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const projectId = process.env.FIREBASE_PROJECT_ID!;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL!;
const privateKey = process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n');

const aiKeys: AiKeys = {
  geminiKey: process.env.GEMINI_API_KEY,
  anthropicKey: process.env.ANTHROPIC_API_KEY,
};

if (!projectId || !clientEmail || !privateKey) {
  console.error('Missing required Firebase env vars. Check backend/.env');
  process.exit(1);
}
if (!hasAiProvider(aiKeys)) {
  console.error('No AI provider configured. Set GEMINI_API_KEY or ANTHROPIC_API_KEY in backend/.env');
  process.exit(1);
}

if (getApps().length === 0) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const db = getFirestore();

const CATEGORY_QUERIES: Record<string, { ko: string; query: string }> = {
  politics: { ko: '정치', query: '정치 뉴스' },
  economy: { ko: '경제', query: '경제 뉴스' },
  ai: { ko: 'AI', query: '인공지능 AI 뉴스' },
  it: { ko: 'IT', query: 'IT 기술 뉴스' },
  science: { ko: '과학', query: '과학 뉴스' },
  industry: { ko: '산업', query: '산업 뉴스' },
  auto: { ko: '자동차', query: '자동차 뉴스' },
  world: { ko: '국제', query: '국제 뉴스' },
  philosophy: { ko: '철학', query: '철학' },
  history: { ko: '역사', query: '역사' },
  sports: { ko: '스포츠', query: '스포츠 뉴스' },
  game: { ko: '게임', query: '게임 뉴스' },
  culture: { ko: '문화', query: '문화 뉴스' },
  life: { ko: '라이프', query: '라이프 생활 정보' },
  shopping: { ko: '쇼핑', query: '쇼핑 트렌드' },
  event: { ko: '이벤트', query: '이벤트 프로모션' },
  'daily-life': { ko: '생활', query: '생활 정보 꿀팁' },
  health: { ko: '건강', query: '건강 뉴스' },
  entertainment: { ko: '연예', query: '연예 뉴스' },
  'welfare-policy': { ko: '정부복지정책', query: '정부 복지 정책 지원금' },
};

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function generateUniqueSlug(base: string): Promise<string> {
  const baseSlug = slugify(base) || 'post';
  let candidate = baseSlug;
  let suffix = 2;
  for (;;) {
    const snap = await db.collection('blog_posts').where('slug', '==', candidate).limit(1).get();
    if (snap.empty) return candidate;
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

interface CollectedArticle {
  title: string;
  link: string;
  pubDate: string;
  snippet: string;
}

async function collect(query: string, limit: number): Promise<CollectedArticle[]> {
  const parser = new Parser();
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
  const feed = await parser.parseURL(url);

  const seen = new Set<string>();
  const items: CollectedArticle[] = [];
  for (const entry of feed.items ?? []) {
    const title = (entry.title ?? '').trim();
    if (!title) continue;
    const key = title.slice(0, 40).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      title,
      link: entry.link ?? '',
      pubDate: entry.pubDate ?? '',
      snippet: (entry.contentSnippet ?? entry.content ?? '').slice(0, 400),
    });
    if (items.length >= limit) break;
  }
  return items;
}

async function writeArticle(categoryKo: string, headline: CollectedArticle) {
  const prompt = `You are a professional Korean news editor writing for the "${categoryKo}" section of AI119, a Korean AI commerce web magazine.

Write an ORIGINAL Korean-language article based on this single headline and snippet (never copy sentences verbatim):

Title: ${headline.title}
Snippet: ${headline.snippet}
URL: ${headline.link}

Requirements:
- State only facts supported by the snippet above — do not invent quotes, numbers, or events not present in the source.
- Structure: an engaging title, a 1-2 sentence excerpt (under 160 characters), and a full body as HTML using only <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>, <a> tags (at least 3 sections, 1500-3000 Korean characters total), 3-5 short bullet "key points", and 3-6 SEO tags.

Return ONLY valid JSON, no markdown fences:
{"title": "...", "excerpt": "...", "content": "<h2>...</h2><p>...</p>", "keyPoints": ["...", "..."], "tags": ["...", "..."]}`;

  const text = await generateText(aiKeys, prompt, 4096);
  const draft = JSON.parse(extractJSON(text)) as Record<string, unknown>;
  return {
    title: String(draft.title ?? headline.title),
    excerpt: String(draft.excerpt ?? ''),
    content: String(draft.content ?? ''),
    keyPoints: Array.isArray(draft.keyPoints) ? draft.keyPoints.map((k) => String(k)) : [],
    tags: Array.isArray(draft.tags) ? draft.tags.map((tg) => String(tg)) : [],
  };
}

async function main() {
  const category = process.argv[2] || 'politics';
  const count = Number(process.argv[3]) || 10;
  const def = CATEGORY_QUERIES[category];
  if (!def) {
    console.error(`Unknown category: ${category}. Valid: ${Object.keys(CATEGORY_QUERIES).join(', ')}`);
    process.exit(1);
  }

  console.log(`Collecting up to ${count} headlines for "${category}" (${def.query})...`);
  const headlines = await collect(def.query, count);
  console.log(`Collected ${headlines.length} distinct headlines.`);

  let created = 0;
  for (const headline of headlines) {
    try {
      const written = await writeArticle(def.ko, headline);
      if (!written.title || !written.content) {
        console.warn(`  Skipped (empty draft): ${headline.title}`);
        continue;
      }
      const slug = await generateUniqueSlug(written.title);
      const now = new Date().toISOString();
      await db.collection('blog_posts').add({
        title: written.title,
        slug,
        excerpt: written.excerpt,
        content: written.content,
        coverImage: null,
        videoUrl: null,
        tags: written.tags,
        published: true,
        category,
        keyPoints: written.keyPoints,
        sources: [{ title: headline.title, url: headline.link }],
        aiGenerated: true,
        views: 0,
        likes: 0,
        createdAt: now,
        updatedAt: now,
      });
      created += 1;
      console.log(`  [${created}] Created draft: ${written.title}`);
    } catch (err) {
      console.error(`  Failed for "${headline.title}":`, err instanceof Error ? err.message : err);
    }
    // Small delay between calls to stay comfortably under free-tier rate limits.
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }

  console.log(`Done. Created ${created}/${headlines.length} draft articles in category "${category}".`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
