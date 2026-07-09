/**
 * Seeds all 36 entries of the Chinese classical strategy text "36계(三十六計)"
 * as evergreen "classics" category blog articles — one post per stratagem,
 * covering its origin, literal meaning, and modern applications.
 *
 * Uses the real BlogService.create() + ImageGeneratorService pipeline (via
 * the NestJS DI graph) so cover images and seeded views/likes/comments are
 * generated exactly as they are for the news-based pipeline.
 *
 * Run: npx ts-node -r dotenv/config src/scripts/seed-36-stratagems.ts
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

interface Stratagem {
  no: number;
  hanja: string;
  ko: string;
}

const STRATAGEMS: Stratagem[] = [
  { no: 1, hanja: '瞞天過海', ko: '만천과해' },
  { no: 2, hanja: '圍魏救趙', ko: '위위구조' },
  { no: 3, hanja: '借刀殺人', ko: '차도살인' },
  { no: 4, hanja: '以逸待勞', ko: '이일대로' },
  { no: 5, hanja: '趁火打劫', ko: '진화타겁' },
  { no: 6, hanja: '聲東擊西', ko: '성동격서' },
  { no: 7, hanja: '無中生有', ko: '무중생유' },
  { no: 8, hanja: '暗渡陳倉', ko: '암도진창' },
  { no: 9, hanja: '隔岸觀火', ko: '격안관화' },
  { no: 10, hanja: '笑裡藏刀', ko: '소리장도' },
  { no: 11, hanja: '李代桃僵', ko: '이대도강' },
  { no: 12, hanja: '順手牽羊', ko: '순수견양' },
  { no: 13, hanja: '打草驚蛇', ko: '타초경사' },
  { no: 14, hanja: '借屍還魂', ko: '차시환혼' },
  { no: 15, hanja: '調虎離山', ko: '조호이산' },
  { no: 16, hanja: '欲擒故縱', ko: '욕금고종' },
  { no: 17, hanja: '拋磚引玉', ko: '포전인옥' },
  { no: 18, hanja: '擒賊擒王', ko: '금적금왕' },
  { no: 19, hanja: '釜底抽薪', ko: '부저추신' },
  { no: 20, hanja: '混水摸魚', ko: '혼수모어' },
  { no: 21, hanja: '金蟬脫殼', ko: '금선탈각' },
  { no: 22, hanja: '關門捉賊', ko: '관문착적' },
  { no: 23, hanja: '遠交近攻', ko: '원교근공' },
  { no: 24, hanja: '假道伐虢', ko: '가도벌괵' },
  { no: 25, hanja: '偷樑換柱', ko: '투량환주' },
  { no: 26, hanja: '指桑罵槐', ko: '지상매괴' },
  { no: 27, hanja: '假痴不癲', ko: '가치부전' },
  { no: 28, hanja: '上屋抽梯', ko: '상옥추제' },
  { no: 29, hanja: '樹上開花', ko: '수상개화' },
  { no: 30, hanja: '反客爲主', ko: '반객위주' },
  { no: 31, hanja: '美人計', ko: '미인계' },
  { no: 32, hanja: '空城計', ko: '공성계' },
  { no: 33, hanja: '反間計', ko: '반간계' },
  { no: 34, hanja: '苦肉計', ko: '고육계' },
  { no: 35, hanja: '連環計', ko: '연환계' },
  { no: 36, hanja: '走爲上', ko: '주위상' },
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

async function writeArticle(item: Stratagem): Promise<WrittenArticle | null> {
  const prompt = `You are a professional Korean editorial writer for AI119's web magazine, writing entry #${item.no} of a 36-part evergreen series on "36계(三十六計, the Thirty-Six Stratagems)", a classical Chinese strategy text.

This entry's stratagem: 제${item.no}계 "${item.ko}(${item.hanja})"

Requirements:
- Write in Korean, based on well-known, publicly documented facts about this stratagem's origin and traditional meaning.
- Structure the body as HTML using only <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em> tags, with these sections in order:
  1. An intro paragraph naming the stratagem and its literal/hanja meaning.
  2. "유래와 의미" — the historical or literary origin (e.g. Warring States period, Three Kingdoms, or classical military history) and literal interpretation.
  3. "현대적 활용" — 2-3 concrete modern applications (business strategy, negotiation, sports, everyday life, or geopolitics) with brief examples.
  4. A short closing paragraph.
  Total length 1200-2000 Korean characters.
- Title format: "삼십육계 제${item.no}계: ${item.ko}(${item.hanja}) — [short Korean tagline capturing its meaning]"
- A 1-2 sentence excerpt (under 160 characters) summarizing the stratagem's core idea.
- Include 3-5 short bullet "key points".
- Include 4-6 SEO tags in Korean, always including "삼십육계" and "${item.ko}".
- Provide a 3-6 word English keyword phrase suitable for searching a stock photo site for a relevant, tasteful image (e.g. "ancient chinese scroll calligraphy", "chess strategy board", "traditional east asian ink painting") — not a literal illustration of the story.

Return ONLY valid JSON, no markdown fences:
{"title": "...", "excerpt": "...", "content": "<h2>...</h2><p>...</p>", "keyPoints": ["...", "..."], "tags": ["...", "..."], "imageQuery": "..."}`;

  try {
    const text = await generateText(aiKeys, prompt, 4096);
    const draft = JSON.parse(extractJSON(text)) as Record<string, unknown>;
    const title = String(draft.title ?? `삼십육계 제${item.no}계: ${item.ko}(${item.hanja})`);
    const content = String(draft.content ?? '');
    if (!title || !content) return null;
    return {
      title,
      excerpt: String(draft.excerpt ?? ''),
      content,
      keyPoints: Array.isArray(draft.keyPoints) ? draft.keyPoints.map((k) => String(k)) : [],
      tags: Array.isArray(draft.tags) ? draft.tags.map((t) => String(t)) : [],
      imageQuery: String(draft.imageQuery ?? ''),
    };
  } catch (err) {
    console.error(`  Write failed for stratagem #${item.no} "${item.ko}":`, err instanceof Error ? err.message : err);
    return null;
  }
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), FirebaseModule, BlogModule, WebzineModule],
})
class Seed36StratagemsModule {}

async function main() {
  if (!hasAiProvider(aiKeys)) {
    console.error('No AI provider configured. Set GEMINI_API_KEY or ANTHROPIC_API_KEY in backend/.env');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(Seed36StratagemsModule, { logger: ['warn', 'error'] });
  try {
    const blog = app.get(BlogService);
    const images = app.get(ImageGeneratorService);

    let created = 0;
    for (const item of STRATAGEMS) {
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
      console.log(`  [${created}/${STRATAGEMS.length}] Created: ${post.title} (image=${Boolean(coverImage)})`);
      await sleep(DELAY_MS);
    }

    console.log(`Done. Created ${created}/${STRATAGEMS.length} stratagem articles.`);
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
