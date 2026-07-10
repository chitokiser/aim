/**
 * Seeds single-article "classics" (고전읽기) posts for major philosophy /
 * literature / Eastern classics / history-politics-economy / self-help
 * source texts — one evergreen article per work (unlike seed-sun-tzu-art-of-war.ts
 * and seed-36-stratagems.ts, which are chaptered multi-part series for texts
 * with a natural chapter structure).
 *
 * Each post is tagged with the work's own title (e.g. "논어") plus its group
 * tag (e.g. "동양고전"), so the frontend's classics filter row can group by
 * the 5 categories: 철학 / 문학 / 동양고전 / 역사·정치·경제 / 자기계발·처세.
 * Also retags the existing 손자병법 (13 chapters) and 삼십육계 (36 stratagems)
 * series with the "동양고전" group tag so they surface under that filter too.
 *
 * LIMIT controls how many WORKS entries (in array order) get processed per
 * run — raise it to continue seeding the rest later. Already-created works
 * are always skipped regardless of LIMIT (idempotent re-run).
 *
 * Run: npx ts-node -r dotenv/config src/scripts/seed-classics-works.ts
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

// How many WORKS entries (in order) to seed this run. Bump this on a later
// run to continue through the rest of the list — already-created works are
// skipped either way.
const LIMIT = 8;

type Group = '철학' | '문학' | '동양고전' | '역사·정치·경제' | '자기계발·처세';

interface Work {
  title: string;
  author: string;
  era: string;
  group: Group;
}

// Ordered with the requested "읽기 좋은 순서" first, then the rest of each
// group. Existing 손자병법/삼십육계 series are intentionally excluded here
// (already seeded as their own chaptered series) — see the retag step below.
const WORKS: Work[] = [
  // -- priority reading order (first 8) --
  { title: '논어', author: '공자', era: '기원전 5세기', group: '동양고전' },
  { title: '명상록', author: '마르쿠스 아우렐리우스', era: '2세기 로마', group: '철학' },
  { title: '도덕경', author: '노자', era: '기원전 6세기경', group: '동양고전' },
  { title: '국가', author: '플라톤', era: '기원전 4세기', group: '철학' },
  { title: '군주론', author: '니콜로 마키아벨리', era: '1513년', group: '철학' },
  { title: '햄릿', author: '윌리엄 셰익스피어', era: '1600년경', group: '문학' },
  { title: '돈키호테', author: '미겔 데 세르반테스', era: '1605년~1615년', group: '문학' },
  { title: '죄와 벌', author: '표도르 도스토옙스키', era: '1866년', group: '문학' },

  // -- 철학 (나머지) --
  { title: '니코마코스 윤리학', author: '아리스토텔레스', era: '기원전 4세기', group: '철학' },
  { title: '사회계약론', author: '장 자크 루소', era: '1762년', group: '철학' },
  { title: '순수이성비판', author: '임마누엘 칸트', era: '1781년', group: '철학' },

  // -- 문학 (나머지) --
  { title: '일리아스', author: '호메로스', era: '기원전 8세기경', group: '문학' },
  { title: '오디세이아', author: '호메로스', era: '기원전 8세기경', group: '문학' },
  { title: '신곡', author: '단테 알리기에리', era: '1320년경', group: '문학' },
  { title: '전쟁과 평화', author: '레프 톨스토이', era: '1869년', group: '문학' },
  { title: '1984', author: '조지 오웰', era: '1949년', group: '문학' },

  // -- 동양고전 (나머지) --
  { title: '맹자', author: '맹자', era: '기원전 4세기', group: '동양고전' },
  { title: '장자', author: '장자', era: '기원전 4세기', group: '동양고전' },
  { title: '삼국지연의', author: '나관중', era: '14세기', group: '동양고전' },

  // -- 역사·정치·경제 --
  { title: '역사(Historiai)', author: '헤로도토스', era: '기원전 5세기', group: '역사·정치·경제' },
  { title: '펠로폰네소스 전쟁사', author: '투키디데스', era: '기원전 5세기', group: '역사·정치·경제' },
  { title: '국부론', author: '애덤 스미스', era: '1776년', group: '역사·정치·경제' },
  { title: '자본론', author: '카를 마르크스', era: '1867년', group: '역사·정치·경제' },
  { title: '법의 정신', author: '몽테스키외', era: '1748년', group: '역사·정치·경제' },

  // -- 자기계발·처세 --
  { title: '채근담', author: '홍자성', era: '17세기경 (명나라)', group: '자기계발·처세' },
  { title: '탈무드', author: '유대 랍비 전승', era: '수세기에 걸쳐 편찬 (3~6세기경 확립)', group: '자기계발·처세' },
];

// Existing chaptered series that predate this script — retagged with their
// group so they surface under the "동양고전" frontend filter alongside the
// new single-article works.
const SERIES_GROUP_RETAGS: { seriesTag: string; group: Group }[] = [
  { seriesTag: '손자병법', group: '동양고전' },
  { seriesTag: '삼십육계', group: '동양고전' },
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

async function writeArticle(work: Work): Promise<WrittenArticle | null> {
  const prompt = `You are a professional Korean editorial writer for AI119's web magazine, writing a single evergreen article introducing the classic work "${work.title}" by ${work.author} (${work.era}).

Requirements:
- Write in Korean, based on well-known, publicly documented facts about this work's content, structure, and historical context. Do not reproduce copyrighted translations verbatim — summarize and explain in your own words.
- Structure the body as HTML using only <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em> tags, with these sections in order:
  1. An intro paragraph naming the work, its author, and era, and why it's still read today.
  2. "핵심 내용과 사상" — the work's central ideas, structure, or narrative, with a well-known quote or episode (translated/paraphrased into natural Korean) if appropriate.
  3. "현대적 시사점" — 2-3 concrete ways its ideas apply to modern life (work, leadership, relationships, decision-making, or society) with brief examples.
  4. A short closing paragraph recommending it to a modern reader.
  Total length 1200-2000 Korean characters.
- Title format: "${work.title} — [short Korean tagline capturing its core theme or value to a modern reader]"
- A 1-2 sentence excerpt (under 160 characters) summarizing why this work matters.
- Include 3-5 short bullet "key points".
- Include 4-6 SEO tags in Korean, always including "${work.title}" and "${work.group}".
- Provide a 3-6 word English keyword phrase suitable for searching a stock photo site for a relevant, tasteful image (e.g. "old leather bound books library", "ancient greek marble columns", "candlelit writing desk manuscript") — not a literal book cover or portrait.

Return ONLY valid JSON, no markdown fences:
{"title": "...", "excerpt": "...", "content": "<h2>...</h2><p>...</p>", "keyPoints": ["...", "..."], "tags": ["...", "..."], "imageQuery": "..."}`;

  try {
    const text = await generateText(aiKeys, prompt, 4096);
    const draft = JSON.parse(extractJSON(text)) as Record<string, unknown>;
    const title = String(draft.title ?? work.title);
    const content = String(draft.content ?? '');
    if (!title || !content) return null;
    const tags = Array.isArray(draft.tags) ? draft.tags.map((t) => String(t)) : [];
    if (!tags.includes(work.title)) tags.push(work.title);
    if (!tags.includes(work.group)) tags.push(work.group);
    return {
      title,
      excerpt: String(draft.excerpt ?? ''),
      content,
      keyPoints: Array.isArray(draft.keyPoints) ? draft.keyPoints.map((k) => String(k)) : [],
      tags,
      imageQuery: String(draft.imageQuery ?? ''),
    };
  } catch (err) {
    console.error(`  Write failed for "${work.title}":`, err instanceof Error ? err.message : err);
    return null;
  }
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), FirebaseModule, BlogModule, WebzineModule],
})
class SeedClassicsWorksModule {}

async function main() {
  if (!hasAiProvider(aiKeys)) {
    console.error('No AI provider configured. Set GEMINI_API_KEY or ANTHROPIC_API_KEY in backend/.env');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(SeedClassicsWorksModule, { logger: ['warn', 'error'] });
  try {
    const blog = app.get(BlogService);
    const images = app.get(ImageGeneratorService);

    const existingPosts = await blog.listAll();
    const classicsPosts = existingPosts.filter((p) => p.category === CATEGORY);

    // Retag existing chaptered series with their group tag (idempotent).
    for (const { seriesTag, group } of SERIES_GROUP_RETAGS) {
      const seriesPosts = classicsPosts.filter((p) => p.tags?.includes(seriesTag) && !p.tags.includes(group));
      for (const post of seriesPosts) {
        await blog.update(post.id, { tags: [...post.tags, group] });
      }
      if (seriesPosts.length > 0) {
        console.log(`Retagged ${seriesPosts.length} "${seriesTag}" posts with group "${group}".`);
      }
    }

    const existingWorkTitles = new Set(
      classicsPosts.flatMap((p) => WORKS.filter((w) => p.tags?.includes(w.title)).map((w) => w.title)),
    );

    const batch = WORKS.slice(0, LIMIT);
    let created = 0;
    for (const work of batch) {
      if (existingWorkTitles.has(work.title)) {
        console.log(`Skipping "${work.title}" (already exists)`);
        continue;
      }
      console.log(`Writing "${work.title}" (${work.group})`);
      const written = await writeArticle(work);
      if (!written) {
        console.warn(`  Skipped (no draft): "${work.title}"`);
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
      console.log(`  [${created}/${batch.length}] Created: ${post.title} (image=${Boolean(coverImage)})`);
      await sleep(DELAY_MS);
    }

    console.log(`Done. Created ${created}/${batch.length} classics work articles (${WORKS.length - LIMIT} remaining beyond LIMIT).`);
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
