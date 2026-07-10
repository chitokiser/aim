import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { BlogService } from '../blog/blog.service';
import { WordPressService, type WordPressTarget } from '../blog/wordpress.service';
import { ImageGeneratorService } from './image-generator.service';
import { generateText, extractJSON, hasAiProvider, type AiKeys } from '../common/ai-text.util';

const CATEGORY = 'classics';
const DELAY_MS = 2500;
const BUDDHIST_TAG = '불교철학';

type ClassicsGroup = '철학' | '문학' | '동양고전' | '역사·정치·경제' | '자기계발·처세';
const CLASSICS_GROUPS: ClassicsGroup[] = ['철학', '문학', '동양고전', '역사·정치·경제', '자기계발·처세'];

// Keep at least this many un-cross-posted WordPress candidates in reserve per
// target; a weekly check tops up to TOPUP_TARGET whenever the backlog drops
// below MIN_BUFFER, so the daily WordPressSchedulerService cron never runs dry.
const MIN_BUFFER = 10;
const TOPUP_TARGET = 20;

interface Topic {
  title: string;
  hint: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Keeps the "classics" (고전읽기) content pipeline self-sustaining. Unlike
 * "trending" (fed daily by the news-driven webzine pipeline), classics and
 * buddhist articles were originally seeded from fixed topic lists
 * (seed-classics-works.ts / seed-buddhist-philosophy.ts) that run out. This
 * service checks each WordPress target's un-cross-posted backlog weekly and,
 * when it's running low, asks the AI to propose new topics not already
 * covered (passing the existing title list) and writes full articles for
 * them — same generation pattern as the seed scripts, just open-ended
 * instead of a fixed array.
 */
@Injectable()
export class ClassicsAutoSeedService {
  private readonly logger = new Logger(ClassicsAutoSeedService.name);
  private readonly aiKeys: AiKeys;
  private running = false;

  constructor(
    private readonly blog: BlogService,
    private readonly wordpress: WordPressService,
    private readonly images: ImageGeneratorService,
    private readonly config: ConfigService,
  ) {
    this.aiKeys = {
      geminiKey: this.config.get<string>('GEMINI_API_KEY'),
      anthropicKey: this.config.get<string>('ANTHROPIC_API_KEY'),
    };
  }

  // Weekly, ahead of the daily WordPress cross-post cron (06:00/07:00 KST) so
  // freshly generated articles are already eligible candidates by then.
  @Cron('0 3 * * 0', { timeZone: 'Asia/Seoul' })
  async handleWeeklyTopUp(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      if (!hasAiProvider(this.aiKeys)) {
        this.logger.warn('No AI provider configured — skipping classics auto-seed top-up.');
        return;
      }
      await this.topUpIfLow('buddhist', (count) => this.topUpBuddhist(count));
      await this.topUpIfLow('classics', (count) => this.topUpGeneralClassics(count));
    } finally {
      this.running = false;
    }
  }

  private async topUpIfLow(target: WordPressTarget, generate: (count: number) => Promise<number>): Promise<void> {
    if (!this.wordpress.isConfigured(target)) return;
    const backlog = await this.blog.listWordPressCandidates(target, TOPUP_TARGET);
    if (backlog.length >= MIN_BUFFER) {
      this.logger.log(`"${target}" backlog healthy (${backlog.length} candidates) — skipping top-up.`);
      return;
    }
    const need = TOPUP_TARGET - backlog.length;
    this.logger.log(`"${target}" backlog low (${backlog.length}/${MIN_BUFFER}) — generating up to ${need} new articles.`);
    const created = await generate(need);
    this.logger.log(`"${target}" auto-seed top-up: created ${created}/${need} new articles.`);
  }

  private async existingClassicsTitles(): Promise<string[]> {
    const all = await this.blog.listAll();
    return all.filter((p) => p.category === CATEGORY).map((p) => p.title);
  }

  private async proposeTopics(domain: string, count: number, existing: string[]): Promise<Topic[]> {
    const prompt = `You are the content strategist for AI119's Korean web magazine "고전읽기" (classics) section, which covers: ${domain}.

Here are titles already published in this section (do not repeat these or close variants):
${existing.slice(0, 250).map((t) => `- ${t}`).join('\n')}

Propose ${count} new, distinct topics for this section that are NOT already covered above. For each, give a short Korean title (the work/concept/figure/scripture name, with hanja or the original term in parentheses if relevant) and a one-line Korean hint describing its core content.

Return ONLY valid JSON, no markdown fences:
[{"title": "...", "hint": "..."}]`;

    try {
      const text = await generateText(this.aiKeys, prompt, 2048);
      const parsed = JSON.parse(extractJSON(text)) as Array<{ title?: unknown; hint?: unknown }>;
      return parsed
        .filter((t) => t.title && t.hint)
        .map((t) => ({ title: String(t.title), hint: String(t.hint) }));
    } catch (err) {
      this.logger.warn(`Topic proposal failed: ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }

  private buddhistArticlePrompt(topic: Topic): string {
    return `You are a professional Korean editorial writer for AI119's web magazine, writing a single evergreen article on the Buddhist philosophy topic "${topic.title}" (${topic.hint}).

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
- Include 4-6 SEO tags in Korean, always including "${BUDDHIST_TAG}" and a short form of "${topic.title}" (without hanja/parentheses).
- Provide a 3-6 word English keyword phrase suitable for searching a stock photo site for a relevant, tasteful image (e.g. "zen garden morning mist", "ancient temple stone steps", "lotus flower calm water") — not a literal deity portrait or religious icon.

Return ONLY valid JSON, no markdown fences:
{"title": "...", "excerpt": "...", "content": "<h2>...</h2><p>...</p>", "keyPoints": ["...", "..."], "tags": ["...", "..."], "imageQuery": "..."}`;
  }

  private classicsArticlePrompt(topic: Topic, group: ClassicsGroup): string {
    return `You are a professional Korean editorial writer for AI119's web magazine, writing a single evergreen article introducing "${topic.title}" (${topic.hint}), a work/topic in the "${group}" category of classic works.

Requirements:
- Write in Korean, based on well-known, publicly documented facts. Do not reproduce copyrighted translations verbatim — summarize and explain in your own words.
- Structure the body as HTML using only <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em> tags, with these sections in order:
  1. An intro paragraph naming the work/topic, its origin, and why it's still relevant today.
  2. "핵심 내용과 사상" — the central ideas, structure, or narrative, with a well-known quote or episode (translated/paraphrased into natural Korean) if appropriate.
  3. "현대적 시사점" — 2-3 concrete ways its ideas apply to modern life (work, leadership, relationships, decision-making, or society) with brief examples.
  4. A short closing paragraph recommending it to a modern reader.
  Total length 1200-2000 Korean characters.
- Title format: "${topic.title} — [short Korean tagline capturing its core theme or value to a modern reader]"
- A 1-2 sentence excerpt (under 160 characters) summarizing why this matters.
- Include 3-5 short bullet "key points".
- Include 4-6 SEO tags in Korean, always including "${topic.title}" and "${group}".
- Provide a 3-6 word English keyword phrase suitable for searching a stock photo site for a relevant, tasteful image — not a literal book cover or portrait.

Return ONLY valid JSON, no markdown fences:
{"title": "...", "excerpt": "...", "content": "<h2>...</h2><p>...</p>", "keyPoints": ["...", "..."], "tags": ["...", "..."], "imageQuery": "..."}`;
  }

  private async writeAndCreate(prompt: string, fallbackTitle: string, extraTags: string[]): Promise<boolean> {
    try {
      const text = await generateText(this.aiKeys, prompt, 4096);
      const draft = JSON.parse(extractJSON(text)) as Record<string, unknown>;
      const title = String(draft.title ?? fallbackTitle);
      const content = String(draft.content ?? '');
      if (!title || !content) return false;
      const tags = Array.isArray(draft.tags) ? draft.tags.map((t) => String(t)) : [];
      for (const t of extraTags) if (!tags.includes(t)) tags.push(t);

      const coverImage = await this.images.generateCoverImage(title, String(draft.imageQuery ?? ''));
      await this.blog.create({
        title,
        excerpt: String(draft.excerpt ?? ''),
        content,
        tags,
        category: CATEGORY,
        keyPoints: Array.isArray(draft.keyPoints) ? draft.keyPoints.map((k) => String(k)) : [],
        sources: [],
        coverImage: coverImage ?? undefined,
        aiGenerated: true,
        published: true,
      });
      return true;
    } catch (err) {
      this.logger.warn(`Write failed for "${fallbackTitle}": ${err instanceof Error ? err.message : err}`);
      return false;
    }
  }

  private async topUpBuddhist(count: number): Promise<number> {
    const existing = await this.existingClassicsTitles();
    const topics = await this.proposeTopics('Buddhist philosophy — scriptures, schools, key figures, and core concepts', count, existing);
    let created = 0;
    for (const topic of topics) {
      const ok = await this.writeAndCreate(this.buddhistArticlePrompt(topic), topic.title, [BUDDHIST_TAG]);
      if (ok) created += 1;
      await sleep(DELAY_MS);
    }
    return created;
  }

  private async topUpGeneralClassics(count: number): Promise<number> {
    const existing = await this.existingClassicsTitles();
    const topics = await this.proposeTopics(
      'World and Eastern classic works of philosophy, literature, history/politics/economics, and self-improvement (excluding Buddhist philosophy, which has its own dedicated section)',
      count,
      existing,
    );
    let created = 0;
    for (const topic of topics) {
      const group = CLASSICS_GROUPS[created % CLASSICS_GROUPS.length];
      const ok = await this.writeAndCreate(this.classicsArticlePrompt(topic, group), topic.title, [group]);
      if (ok) created += 1;
      await sleep(DELAY_MS);
    }
    return created;
  }
}
