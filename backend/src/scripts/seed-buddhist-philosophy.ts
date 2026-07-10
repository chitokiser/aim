/**
 * Seeds single-article "classics" (고전읽기) posts for core Buddhist philosophy
 * topics — one evergreen article per topic (same pattern as seed-classics-works.ts),
 * tagged with "불교철학" as the group tag so the frontend's classics filter row
 * can surface them as their own sub-series alongside 철학/문학/동양고전/
 * 역사·정치·경제/자기계발·처세.
 *
 * LIMIT controls how many TOPICS entries (in array order) get processed per
 * run — raise it to continue seeding the rest later. Already-created topics
 * are always skipped regardless of LIMIT (idempotent re-run).
 *
 * Run: npx ts-node -r dotenv/config src/scripts/seed-buddhist-philosophy.ts
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
const GROUP = '불교철학';

// How many TOPICS entries (in order) to seed this run.
const LIMIT = 30;

interface Topic {
  title: string;
  hint: string;
}

// Ordered roughly foundational -> scriptural -> schools/figures -> modern relevance.
const TOPICS: Topic[] = [
  { title: '사성제(四聖諦)', hint: '고집멸도, 괴로움의 원인과 소멸에 이르는 네 가지 진리' },
  { title: '팔정도(八正道)', hint: '정견·정사유 등 여덟 가지 바른 실천 덕목' },
  { title: '연기법(緣起法)', hint: '모든 존재는 조건에 의해 상호 의존하여 일어난다는 불교의 핵심 세계관' },
  { title: '무아(無我)', hint: '고정불변의 자아는 없다는 가르침, 오온과의 관계' },
  { title: '제행무상(諸行無常)', hint: '모든 형성된 것은 끊임없이 변한다는 무상의 가르침' },
  { title: '일체개고(一切皆苦)', hint: '괴로움의 본질과 둑카(dukkha)의 세 가지 층위' },
  { title: '열반(涅槃)', hint: '탐진치의 소멸과 궁극적 해탈의 상태' },
  { title: '반야심경(般若心經)', hint: '색즉시공 공즉시색, 공(空) 사상을 담은 대표 경전 해설' },
  { title: '금강경(金剛經)', hint: '집착 없는 보시와 상(相)을 여의는 지혜, 응무소주 이생기심' },
  { title: '법화경(法華經)', hint: '일승사상과 회삼귀일, 누구나 성불할 수 있다는 가르침' },
  { title: '화엄경(華嚴經)', hint: '중중무진 법계연기, 하나가 곧 전체라는 화엄의 세계관' },
  { title: '유식사상(唯識思想)', hint: '아뢰야식과 모든 것은 마음의 작용이라는 유가행파의 통찰' },
  { title: '중관사상과 용수(龍樹)', hint: '공(空)과 중도를 논증한 나가르주나의 중론' },
  { title: '오온(五蘊)', hint: '색수상행식, 존재를 구성하는 다섯 가지 요소' },
  { title: '십이연기(十二緣起)', hint: '무명에서 노사에 이르는 열두 단계의 인과 사슬' },
  { title: '삼법인(三法印)', hint: '제행무상·제법무아·열반적정, 불교를 규정하는 세 가지 표식' },
  { title: '업(業)과 윤회(輪回)', hint: '행위가 남기는 흔적과 생사의 순환에 대한 불교적 이해' },
  { title: '자비(慈悲)의 철학', hint: '자(慈)와 비(悲)의 차이, 사무량심과 이타적 실천' },
  { title: '선종(禪宗)과 참선', hint: '언어를 넘어선 직관적 깨달음을 추구하는 선 수행의 전통' },
  { title: '화두와 공안(公案)', hint: '이뭣고, 무자화두 등 선문답을 통한 깨달음의 방편' },
  { title: '육조단경(六祖壇經)', hint: '혜능의 돈오사상과 본래무일물의 가르침' },
  { title: '달마대사와 선의 전래', hint: '면벽구년과 동아시아 선불교의 시작' },
  { title: '원효대사와 화쟁사상', hint: '일심사상과 대립하는 견해를 화해시키는 화쟁의 지혜' },
  { title: '지눌과 돈오점수', hint: '먼저 깨닫고 점차 닦는다는 고려 불교의 수행론' },
  { title: '보살사상과 대승불교', hint: '자리이타의 보살행과 육바라밀' },
  { title: '상좌부 불교(테라와다)', hint: '초기 경전 중심의 남방 불교 전통과 위빠사나 수행' },
  { title: '티베트 불교와 밀교', hint: '만다라, 진언, 환생 라마 제도를 중심으로 한 밀교 전통' },
  { title: '마음챙김(Mindfulness)과 현대 심리학', hint: '사티(sati) 수행이 서구 심리치료에 접목된 과정' },
  { title: '불교와 현대 과학의 대화', hint: '양자역학·뇌과학이 조명하는 무아와 연기의 통찰' },
  { title: '간화선과 위빠사나 비교', hint: '동아시아 화두 참선과 남방 관법 수행의 접근 차이' },
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

async function writeArticle(topic: Topic): Promise<WrittenArticle | null> {
  const prompt = `You are a professional Korean editorial writer for AI119's web magazine, writing a single evergreen article on the Buddhist philosophy topic "${topic.title}" (${topic.hint}).

Requirements:
- Write in Korean, based on well-known, publicly documented Buddhist teachings and scholarship. Present the topic respectfully and accurately as philosophy/intellectual history, not as religious advocacy for any specific sect.
- Structure the body as HTML using only <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em> tags, with these sections in order:
  1. An intro paragraph introducing the concept/text/school and its place in Buddhist thought.
  2. "핵심 사상과 의미" — the core teaching explained clearly, with a well-known passage, episode, or example if appropriate (paraphrased into natural Korean, not verbatim scripture translation).
  3. "현대적 시사점" — 2-3 concrete ways this idea resonates with modern life (mental health, decision-making, relationships, or self-understanding) with brief examples.
  4. A short closing paragraph on why this idea remains relevant today.
  Total length 1200-2000 Korean characters.
- Title format: "${topic.title} — [short Korean tagline capturing its core theme or value to a modern reader]"
- A 1-2 sentence excerpt (under 160 characters) summarizing why this topic matters.
- Include 3-5 short bullet "key points".
- Include 4-6 SEO tags in Korean, always including "불교철학" and a short form of "${topic.title}" (without hanja/parentheses).
- Provide a 3-6 word English keyword phrase suitable for searching a stock photo site for a relevant, tasteful image (e.g. "zen garden morning mist", "ancient temple stone steps", "lotus flower calm water") — not a literal deity portrait or religious icon.

Return ONLY valid JSON, no markdown fences:
{"title": "...", "excerpt": "...", "content": "<h2>...</h2><p>...</p>", "keyPoints": ["...", "..."], "tags": ["...", "..."], "imageQuery": "..."}`;

  try {
    const text = await generateText(aiKeys, prompt, 4096);
    const draft = JSON.parse(extractJSON(text)) as Record<string, unknown>;
    const title = String(draft.title ?? topic.title);
    const content = String(draft.content ?? '');
    if (!title || !content) return null;
    const tags = Array.isArray(draft.tags) ? draft.tags.map((t) => String(t)) : [];
    if (!tags.includes(GROUP)) tags.push(GROUP);
    return {
      title,
      excerpt: String(draft.excerpt ?? ''),
      content,
      keyPoints: Array.isArray(draft.keyPoints) ? draft.keyPoints.map((k) => String(k)) : [],
      tags,
      imageQuery: String(draft.imageQuery ?? ''),
    };
  } catch (err) {
    console.error(`  Write failed for "${topic.title}":`, err instanceof Error ? err.message : err);
    return null;
  }
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), FirebaseModule, BlogModule, WebzineModule],
})
class SeedBuddhistPhilosophyModule {}

async function main() {
  if (!hasAiProvider(aiKeys)) {
    console.error('No AI provider configured. Set GEMINI_API_KEY or ANTHROPIC_API_KEY in backend/.env');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(SeedBuddhistPhilosophyModule, { logger: ['warn', 'error'] });
  try {
    const blog = app.get(BlogService);
    const images = app.get(ImageGeneratorService);

    const existingPosts = await blog.listAll();
    const classicsPosts = existingPosts.filter((p) => p.category === CATEGORY);
    const existingTopicTitles = new Set(
      classicsPosts.flatMap((p) => TOPICS.filter((t) => p.tags?.includes(GROUP) && p.title.startsWith(t.title)).map((t) => t.title)),
    );

    const batch = TOPICS.slice(0, LIMIT);
    let created = 0;
    for (const topic of batch) {
      if (existingTopicTitles.has(topic.title)) {
        console.log(`Skipping "${topic.title}" (already exists)`);
        continue;
      }
      console.log(`Writing "${topic.title}"`);
      const written = await writeArticle(topic);
      if (!written) {
        console.warn(`  Skipped (no draft): "${topic.title}"`);
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

    console.log(`Done. Created ${created}/${batch.length} Buddhist philosophy articles.`);
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
