/**
 * Seeds all 13 chapters (편) of Sun Tzu's Art of War (손자병법) as evergreen
 * "classics" category blog articles — one post per chapter, covering its
 * core teachings and modern applications. Companion series to
 * seed-36-stratagems.ts; every post is tagged "손자병법" so the two series
 * can be filtered as sub-categories within the "classics" (고전읽기) category
 * on the frontend blog page.
 *
 * Uses the real BlogService.create() + ImageGeneratorService pipeline (via
 * the NestJS DI graph) so cover images (Pexels/Pixabay first, Imagen as
 * last resort) and seeded views/likes/comments are generated exactly as
 * they are for the news-based pipeline.
 *
 * Run: npx ts-node -r dotenv/config src/scripts/seed-sun-tzu-art-of-war.ts
 */
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { FirebaseModule } from '../firebase/firebase.module';
import { BlogModule } from '../blog/blog.module';
import { BlogService } from '../blog/blog.service';
import { WebzineModule } from '../webzine/webzine.module';
import { ImageGeneratorService } from '../webzine/image-generator.service';
import { generateText, extractJSON, hasAiProvider, type AiKeys } from '../common/ai-text.util';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DELAY_MS = 2500;
const CATEGORY = 'classics';
const SERIES_TAG = '손자병법';

interface Chapter {
  no: number;
  hanja: string;
  ko: string;
  en: string;
}

const CHAPTERS: Chapter[] = [
  { no: 1, hanja: '始計', ko: '시계편', en: 'Laying Plans' },
  { no: 2, hanja: '作戰', ko: '작전편', en: 'Waging War' },
  { no: 3, hanja: '謀攻', ko: '모공편', en: 'Attack by Stratagem' },
  { no: 4, hanja: '軍形', ko: '군형편', en: 'Tactical Dispositions' },
  { no: 5, hanja: '兵勢', ko: '병세편', en: 'Energy' },
  { no: 6, hanja: '虛實', ko: '허실편', en: 'Weak Points and Strong' },
  { no: 7, hanja: '軍爭', ko: '군쟁편', en: 'Maneuvering' },
  { no: 8, hanja: '九變', ko: '구변편', en: 'Variation in Tactics' },
  { no: 9, hanja: '行軍', ko: '행군편', en: 'The Army on the March' },
  { no: 10, hanja: '地形', ko: '지형편', en: 'Terrain' },
  { no: 11, hanja: '九地', ko: '구지편', en: 'The Nine Situations' },
  { no: 12, hanja: '火攻', ko: '화공편', en: 'The Attack by Fire' },
  { no: 13, hanja: '用間', ko: '용간편', en: 'The Use of Spies' },
];

const aiKeys: AiKeys = {
  geminiKey: process.env.GEMINI_API_KEY,
  anthropicKey: process.env.ANTHROPIC_API_KEY,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface WrittenArticle {
  title: string;
  excerpt: string;
  content: string;
  keyPoints: string[];
  tags: string[];
  imageQuery: string;
}

async function writeArticle(item: Chapter): Promise<WrittenArticle | null> {
  const prompt = `You are a professional Korean editorial writer for AI119's web magazine, writing entry #${item.no} of a 13-part evergreen series on "손자병법(孫子兵法, Sun Tzu's The Art of War)", the classical Chinese military treatise.

This entry's chapter: 제${item.no}편 "${item.ko}(${item.hanja} — ${item.en})"

Requirements:
- Write in Korean, based on well-known, publicly documented facts about this chapter's traditional content and teachings.
- Structure the body as HTML using only <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em> tags, with these sections in order:
  1. An intro paragraph naming the chapter and its core theme.
  2. "핵심 가르침" — the chapter's main principles and teachings, with 1-2 well-known quotes from the text (translated into natural Korean) if appropriate.
  3. "현대적 활용" — 2-3 concrete modern applications (business strategy, leadership, negotiation, sports, or everyday decision-making) with brief examples.
  4. A short closing paragraph.
  Total length 1200-2000 Korean characters.
- Title format: "손자병법 제${item.no}편: ${item.ko}(${item.hanja}) — [short Korean tagline capturing its core theme]"
- A 1-2 sentence excerpt (under 160 characters) summarizing the chapter's core idea.
- Include 3-5 short bullet "key points".
- Include 4-6 SEO tags in Korean, always including "손자병법" and "${item.ko}".
- Provide a 3-6 word English keyword phrase suitable for searching a stock photo site for a relevant, tasteful image (e.g. "ancient chinese scroll calligraphy", "chess strategy board", "traditional east asian ink painting") — not a literal illustration of the text.

Return ONLY valid JSON, no markdown fences:
{"title": "...", "excerpt": "...", "content": "<h2>...</h2><p>...</p>", "keyPoints": ["...", "..."], "tags": ["...", "..."], "imageQuery": "..."}`;

  try {
    const text = await generateText(aiKeys, prompt, 4096);
    const draft = JSON.parse(extractJSON(text)) as Record<string, unknown>;
    const title = String(draft.title ?? `손자병법 제${item.no}편: ${item.ko}(${item.hanja})`);
    const content = String(draft.content ?? '');
    if (!title || !content) return null;
    const tags = Array.isArray(draft.tags) ? draft.tags.map((t) => String(t)) : [];
    if (!tags.includes(SERIES_TAG)) tags.push(SERIES_TAG);
    return {
      title,
      excerpt: String(draft.excerpt ?? ''),
      content,
      keyPoints: Array.isArray(draft.keyPoints) ? draft.keyPoints.map((k) => String(k)) : [],
      tags,
      imageQuery: String(draft.imageQuery ?? ''),
    };
  } catch (err) {
    console.error(`  Write failed for chapter #${item.no} "${item.ko}":`, err instanceof Error ? err.message : err);
    return null;
  }
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), FirebaseModule, BlogModule, WebzineModule],
})
class SeedSunTzuModule {}

async function main() {
  if (!hasAiProvider(aiKeys)) {
    console.error('No AI provider configured. Set GEMINI_API_KEY or ANTHROPIC_API_KEY in backend/.env');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(SeedSunTzuModule, { logger: ['warn', 'error'] });
  try {
    const blog = app.get(BlogService);
    const images = app.get(ImageGeneratorService);

    // Idempotent re-run support: skip chapters already created by a previous
    // (possibly partial, e.g. rate-limited) run instead of duplicating them.
    const existingPosts = await blog.listAll();
    const existingChapterNos = new Set(
      existingPosts
        .filter((p) => p.tags?.includes(SERIES_TAG))
        .map((p) => p.title.match(/제(\d+)편/)?.[1])
        .filter((n): n is string => Boolean(n))
        .map(Number),
    );

    let created = 0;
    for (const item of CHAPTERS) {
      if (existingChapterNos.has(item.no)) {
        console.log(`Skipping #${item.no}: ${item.ko} (already exists)`);
        continue;
      }
      console.log(`Writing #${item.no}: ${item.ko}(${item.hanja})`);
      const written = await writeArticle(item);
      if (!written) {
        console.warn(`  Skipped (no draft): #${item.no} ${item.ko}`);
        await sleep(DELAY_MS);
        continue;
      }

      const coverImage = await images.generateCoverImage(written.title, written.imageQuery);
      const post = await blog.create({
        title: written.title,
        excerpt: written.excerpt,
        content: written.content,
        tags: written.tags,
        category: CATEGORY,
        keyPoints: written.keyPoints,
        sources: [],
        coverImage: coverImage ?? undefined,
        aiGenerated: true,
        published: true,
      });
      created += 1;
      console.log(`  [${created}/${CHAPTERS.length}] Created: ${post.title} (image=${Boolean(coverImage)})`);
      await sleep(DELAY_MS);
    }

    console.log(`Done. Created ${created}/${CHAPTERS.length} Art of War chapter articles.`);
  } finally {
    await app.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
