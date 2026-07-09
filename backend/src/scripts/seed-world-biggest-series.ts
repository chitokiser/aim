/**
 * Seeds a large evergreen content plan of knowledge-based listicle/explainer
 * articles (world's biggest facilities, mega-equipment, "how it's made",
 * price rankings, comparisons, AI/automation explainers, country round-ups,
 * project overviews, and question-form SEO titles) expected to draw steady
 * long-tail search traffic — as opposed to the news-based webzine pipeline.
 *
 * There's no underlying news source for these, so this script prompts the
 * AI directly for well-known, publicly documented facts and explicitly asks
 * it to hedge on specific figures that change over time or vary by source,
 * rather than presenting exact real-time numbers as certain.
 *
 * Uses the real BlogService.create() + ImageGeneratorService pipeline (via
 * the NestJS DI graph) so cover images and seeded views/likes/comments are
 * generated exactly as they are for the news-based pipeline.
 *
 * Run: npx ts-node -r dotenv/config src/scripts/seed-world-biggest-series.ts
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

interface SeriesTopic {
  topic: string;
  category: string;
  keepTitleAsIs?: boolean;
  avoidNewsFraming?: boolean;
}

function series(topics: string[], category: string, opts?: Partial<SeriesTopic>): SeriesTopic[] {
  return topics.map((topic) => ({ topic, category, ...opts }));
}

const TOPICS: SeriesTopic[] = [
  // 1. World's Biggest facilities
  ...series(
    [
      '세계에서 가장 큰 공장 TOP 100',
      '세계 최대 자동차 공장',
      '세계 최대 반도체 공장',
      '세계 최대 조선소',
      '세계 최대 항만',
      '세계 최대 발전소',
      '세계 최대 태양광 발전소',
      '세계 최대 풍력발전단지',
      '세계 최대 물류센터',
      '세계 최대 창고',
      '세계 최대 데이터센터',
      '세계 최대 광산',
      '세계 최대 제철소',
      '세계 최대 화학공장',
      '세계 최대 시멘트 공장',
      '세계 최대 정유공장',
      '세계 최대 배터리 공장',
      '세계 최대 로봇 공장',
      '세계 최대 식품 공장',
      '세계 최대 농장',
    ],
    'industry',
  ),
  // 2. Mega equipment
  ...series(
    [
      '세계 최대 굴착기',
      '세계 최대 덤프트럭',
      '세계 최대 크레인',
      '세계 최대 불도저',
      '세계 최대 로더',
      '세계 최대 터널 굴착기(TBM)',
      '세계 최대 광산 장비',
      '세계 최대 컨테이너 크레인',
      '세계 최대 이동식 크레인',
      '세계 최대 농기계',
      '세계 최대 트랙터',
      '세계 최대 헬리콥터',
      '세계 최대 여객기',
      '세계 최대 화물기',
    ],
    'industry',
  ),
  // 3. How it's made
  ...series(
    [
      '자동차는 어떻게 만들어질까?',
      '아이폰은 어떻게 생산될까?',
      '비행기는 어떻게 제작될까?',
      'LNG선은 어떻게 만들어질까?',
      '반도체는 어떻게 생산될까?',
      '시멘트는 어떻게 만들어질까?',
      '철강은 어떻게 생산될까?',
      '유리는 어떻게 만들어질까?',
      '타이어는 어떻게 만들어질까?',
      '초콜릿은 어떻게 만들어질까?',
    ],
    'industry',
  ),
  // 4. Price series
  ...series(
    [
      '세계에서 가장 비싼 굴착기',
      '가장 비싼 크레인',
      '가장 비싼 불도저',
      '가장 비싼 항공기',
      '가장 비싼 선박',
      '가장 비싼 공장',
      '가장 비싼 건설 프로젝트',
      '가장 비싼 발전소',
    ],
    'industry',
  ),
  // 5. Ranking content
  ...series(
    [
      '세계 최대 공장 TOP 50',
      '세계 최대 건설장비 TOP 20',
      '세계 최대 선박 TOP 30',
      '세계 최대 광산 TOP 20',
      '세계 최대 항만 TOP 30',
      '세계 최대 공항 TOP 50',
      '세계 최대 철도역 TOP 20',
      '세계 최대 댐 TOP 20',
    ],
    'industry',
  ),
  // 6. Comparisons
  ...series(
    [
      '굴착기 크기 비교',
      '세계 최대 vs 국내 최대 공장',
      'CAT vs Komatsu 비교',
      '전기 굴착기 vs 디젤 굴착기',
      '자동화 공장 vs 일반 공장',
      'AI 로봇 vs 산업용 로봇',
    ],
    'industry',
  ),
  // 7. AI & automation
  ...series(
    [
      'AI가 운영하는 공장',
      '무인 공장의 미래',
      '스마트팩토리란?',
      '협동로봇이란?',
      '물류 로봇의 종류',
      'AGV와 AMR의 차이',
      '디지털 트윈이란?',
      '산업용 AI 활용 사례',
    ],
    'ai',
  ),
  // 8. Country round-ups
  ...series(
    [
      '중국 최대 공장',
      '미국 최대 공장',
      '일본 최대 공장',
      '독일 최대 공장',
      '한국 최대 공장',
      '인도 최대 공장',
      '베트남 최대 공장',
      '사우디아라비아 초대형 프로젝트',
    ],
    'world',
  ),
  // 9. Latest project overviews (evergreen, not real-time news)
  ...series(
    [
      '세계 최대 데이터센터 건설 현황',
      '초대형 반도체 공장 건설 소식',
      '신규 원자력 발전소 프로젝트',
      '세계 최대 해상풍력 프로젝트',
      '미래형 스마트시티 건설',
      '대형 교량·터널 건설 현황',
    ],
    'industry',
    { avoidNewsFraming: true },
  ),
  // 10. Question-form SEO titles
  ...series(
    [
      '세계에서 가장 큰 공장은 어디일까?',
      '가장 큰 굴착기는 얼마나 클까?',
      '컨테이너선은 어떻게 만들어질까?',
      '로봇이 사람을 대신하는 공장은 어디일까?',
      '세계 최대 광산은 얼마나 넓을까?',
      '초대형 크레인은 몇 톤까지 들 수 있을까?',
      '스마트팩토리는 무엇이 다를까?',
      '공장은 하루에 자동차를 몇 대 생산할까?',
    ],
    'industry',
    { keepTitleAsIs: true },
  ),
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

async function writeArticle(item: SeriesTopic): Promise<WrittenArticle | null> {
  const extraNotes = [
    item.keepTitleAsIs
      ? `Use this exact phrase as the article title (Korean), do not rephrase it: "${item.topic}"`
      : '',
    item.avoidNewsFraming
      ? 'Do not claim this is breaking or up-to-the-minute news — frame it as a general, evergreen overview of major/notable projects and well-known examples in this area, not a specific dated news report.'
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const prompt = `You are a professional Korean editorial writer for AI119's web magazine, writing an entry in an evergreen industrial/technology reference series.

Topic: "${item.topic}"
${extraNotes}

Requirements:
- Write in Korean, based only on well-known, publicly documented facts and general knowledge.
- Figures like exact capacity, price, area, weight, or output change over time and vary by source — describe them as approximate/well-known estimates (e.g. "약 ~로 알려져 있다", "~수준으로 평가받는다") rather than stating precise numbers as certain fact. Do not fabricate specific statistics you aren't confident about; when uncertain, describe general scale and reputation instead of inventing a number.
- Structure: an engaging Korean title, a 1-2 sentence excerpt (under 160 characters), and a full body as HTML using only <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>, <a> tags — at least 3 sections, 1200-2500 Korean characters total.
- Include 3-5 short bullet "key points" and 3-6 SEO tags (Korean).
- Also provide a 3-6 word English keyword phrase suitable for searching a stock photo site for a real, relevant photo (e.g. "excavator construction site", "semiconductor factory clean room") — not a description of an illustration.

Return ONLY valid JSON, no markdown fences:
{"title": "...", "excerpt": "...", "content": "<h2>...</h2><p>...</p>", "keyPoints": ["...", "..."], "tags": ["...", "..."], "imageQuery": "..."}`;

  try {
    const text = await generateText(aiKeys, prompt, 4096);
    const draft = JSON.parse(extractJSON(text)) as Record<string, unknown>;
    const title = item.keepTitleAsIs ? item.topic : String(draft.title ?? item.topic);
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
    console.error(`  Write failed for "${item.topic}":`, err instanceof Error ? err.message : err);
    return null;
  }
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), FirebaseModule, BlogModule, WebzineModule],
})
class SeedSeriesModule {}

async function main() {
  if (!hasAiProvider(aiKeys)) {
    console.error('No AI provider configured. Set GEMINI_API_KEY or ANTHROPIC_API_KEY in backend/.env');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(SeedSeriesModule, { logger: ['warn', 'error'] });
  try {
    const blog = app.get(BlogService);
    const images = app.get(ImageGeneratorService);

    let created = 0;
    for (const item of TOPICS) {
      console.log(`Writing: ${item.topic}`);
      const written = await writeArticle(item);
      if (!written) {
        console.warn(`  Skipped (no draft): ${item.topic}`);
        await sleep(DELAY_MS);
        continue;
      }

      const coverImage = await images.generateCoverImage(written.title, written.imageQuery);
      const post = await blog.create({
        title: written.title,
        excerpt: written.excerpt,
        content: written.content,
        tags: written.tags,
        category: item.category,
        keyPoints: written.keyPoints,
        sources: [],
        coverImage: coverImage ?? undefined,
        aiGenerated: true,
        published: true,
      });
      created += 1;
      console.log(`  [${created}/${TOPICS.length}] Created: ${post.title} (category=${item.category}, image=${Boolean(coverImage)})`);
      await sleep(DELAY_MS);
    }

    console.log(`Done. Created ${created}/${TOPICS.length} articles across the content series.`);
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
