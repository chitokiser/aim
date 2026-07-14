import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { BlogService } from '../blog/blog.service';
import { ImageGeneratorService } from './image-generator.service';
import { generateText, extractJSON, hasAiProvider, estimateTextCostUsd, type AiKeys } from '../common/ai-text.util';
import { AiBudgetService } from '../common/ai-budget.service';

const CATEGORY = 'silver-ai-bootcamp';
const PROPOSE_MAX_TOKENS = 2048;
const WRITE_MAX_TOKENS = 4096;

interface Topic {
  title: string;
  hint: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Writes practical, hands-on AI skill tutorials for the "실버 AI부트캠프"
 * (Silver AI Bootcamp) category, aimed at readers in their 50s-70s+ who want
 * to actually become able to work/earn online with AI tools (the site's
 * framing of a "digital nomad" life) — not general AI news roundups. Unlike
 * the news-driven webzine pipeline (WebzineSchedulerService), this proposes
 * concrete step-by-step topics directly and writes full tutorials, the same
 * proposal+write pattern as ClassicsAutoSeedService.
 */
@Injectable()
export class SilverAiBootcampService {
  private readonly logger = new Logger(SilverAiBootcampService.name);
  private readonly aiKeys: AiKeys;
  private running = false;

  constructor(
    private readonly blog: BlogService,
    private readonly images: ImageGeneratorService,
    private readonly config: ConfigService,
    private readonly budget: AiBudgetService,
  ) {
    this.aiKeys = {
      geminiKey: this.config.get<string>('GEMINI_API_KEY'),
      anthropicKey: this.config.get<string>('ANTHROPIC_API_KEY'),
    };
  }

  // Publishes exactly one new tutorial every 4 hours, offset from the other
  // category crons. Admin-authored drafts (written by hand in the admin
  // panel, left unpublished) always take priority over AI generation — if
  // one is waiting, publish it and skip AI generation for this cycle instead
  // of spending AI budget on a new one.
  @Cron('20 */4 * * *')
  async handleHourlyCron(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const manualDraft = await this.blog.getOldestManualDraft(CATEGORY);
      if (manualDraft) {
        await this.blog.update(manualDraft.id, { published: true });
        this.logger.log(`Silver AI Bootcamp: published admin-authored draft "${manualDraft.title}".`);
        await this.crossPostToAllSns(manualDraft.id, manualDraft.title);
        return;
      }

      if (!hasAiProvider(this.aiKeys)) return;
      await this.topUp(1);
    } catch (err) {
      this.logger.warn(`Silver AI Bootcamp hourly run failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.running = false;
    }
  }

  // AI-generated posts trickle out to Blogger/WordPress/Tumblr/Facebook via
  // each platform's own scheduled cron (a few per day, oldest-backlog-first).
  // Admin-authored posts are hand-written and meant to go out everywhere at
  // once, so cross-post to all four immediately instead of waiting for those
  // crons to pick it up. Each backfill call is independently idempotent and
  // already-posted-safe, so run them in parallel and let each fail on its own.
  private async crossPostToAllSns(postId: string, title: string): Promise<void> {
    const channels: Array<[string, () => Promise<{ status: string; url?: string }>]> = [
      ['Blogger', () => this.blog.backfillBloggerPost(postId)],
      ['WordPress', () => this.blog.backfillWordPressPost(postId)],
      ['Tumblr', () => this.blog.backfillTumblrPost(postId)],
      ['Facebook', () => this.blog.backfillFacebookPost(postId)],
    ];
    const results = await Promise.allSettled(channels.map(([, run]) => run()));
    results.forEach((result, i) => {
      const [label] = channels[i];
      if (result.status === 'fulfilled') {
        this.logger.log(`Silver AI Bootcamp: ${label} cross-post for "${title}" -> ${result.value.status}`);
      } else {
        this.logger.warn(`Silver AI Bootcamp: ${label} cross-post for "${title}" failed: ${String(result.reason)}`);
      }
    });
  }

  private async existingTitles(): Promise<string[]> {
    const all = await this.blog.listAll();
    return all.filter((p) => p.category === CATEGORY).map((p) => p.title);
  }

  private async proposeTopics(count: number, existing: string[]): Promise<Topic[]> {
    if (!(await this.budget.canSpend(estimateTextCostUsd(PROPOSE_MAX_TOKENS)))) return [];

    const prompt = `You are the content strategist for AI119's Korean web magazine section "실버 AI부트캠프" (Silver AI Bootcamp).

This section teaches readers in their 50s, 60s, and 70s+ concrete, hands-on skills for using AI tools (ChatGPT, Gemini, and similar) to write, create images, run a YouTube channel or blog, automate routine tasks, and earn online income — practical skills for starting a new, location-independent "digital nomad" chapter of life, regardless of age.

Here are tutorial titles already published (do not repeat these or close variants):
${existing.slice(0, 250).map((t) => `- ${t}`).join('\n')}

Propose ${count} new, distinct practical tutorial topics NOT already covered above. Each must be a concrete skill or task with a clear step-by-step outcome (e.g. "챗GPT로 블로그 글 5분 만에 쓰는 법", "제미나이로 유튜브 썸네일 만들기", "AI로 자기소개서 다듬는 법", "챗GPT 음성 기능으로 손 안 쓰고 질문하기") — never a vague topic like "AI의 미래" or a news-roundup subject.

For each, give a short Korean title (the concrete skill/task) and a one-line Korean hint describing exactly what the reader will be able to do after reading.

Return ONLY valid JSON, no markdown fences:
[{"title": "...", "hint": "..."}]`;

    try {
      const text = await generateText(this.aiKeys, prompt, PROPOSE_MAX_TOKENS);
      await this.budget.recordSpend(estimateTextCostUsd(PROPOSE_MAX_TOKENS));
      const parsed = JSON.parse(extractJSON(text)) as Array<{ title?: unknown; hint?: unknown }>;
      return parsed
        .filter((t) => t.title && t.hint)
        .map((t) => ({ title: String(t.title), hint: String(t.hint) }));
    } catch (err) {
      this.logger.warn(`Topic proposal failed: ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }

  private articlePrompt(topic: Topic): string {
    return `You are a friendly, patient Korean instructor writing a single practical tutorial for AI119's "실버 AI부트캠프" (Silver AI Bootcamp) section. Your readers are in their 50s, 60s, and 70s+, many trying AI tools for the very first time.

Topic: "${topic.title}" (${topic.hint})

Requirements:
- Write in Korean, in a warm, encouraging, non-condescending tone. Explain every technical term in plain language the first time it's used (e.g. "프롬프트(AI에게 내리는 명령어)").
- Structure the body as HTML using only <h2>, <h3>, <p>, <ol>, <li>, <strong>, <em> tags, with these sections in order:
  1. A short intro paragraph: what the reader will be able to do by the end, and why it's worth learning (a concrete real-life benefit — saving time, extra income, staying connected with family, etc.).
  2. "준비물" — a short list of what's needed (e.g. "스마트폰 또는 컴퓨터, 챗GPT 무료 계정").
  3. "따라 하기" — a numbered <ol> of concrete, sequential steps (at least 5-8 steps), each step specific enough to actually follow (name real buttons/menus/actions, e.g. "화면 하단의 입력창에 다음과 같이 입력하세요:"). Include at least one example prompt or phrase the reader can literally type/say.
  4. "이럴 때 도움이 돼요" — 2-3 concrete everyday or income-earning scenarios where this skill helps.
  5. A short closing paragraph of encouragement, emphasizing that age is not a barrier and mistakes while learning are normal.
  Total length 1200-2000 Korean characters.
- Title format: "${topic.title}" (keep it as-is, or lightly polish for clarity — do not make it vague).
- A 1-2 sentence excerpt (under 160 characters) stating the concrete outcome.
- Include 3-5 short bullet "key points" (each a specific takeaway, not a summary sentence).
- Include 4-6 SEO tags in Korean, always including "실버AI부트캠프" and a short form of the core tool/skill (e.g. "챗GPT", "온라인부업").
- Provide a 3-6 word English keyword phrase suitable for searching a stock photo site for a warm, realistic photo of an older adult using a phone/computer (e.g. "senior woman smartphone smiling", "older man laptop home office") — not a generic tech/robot image.

Return ONLY valid JSON, no markdown fences:
{"title": "...", "excerpt": "...", "content": "<h2>...</h2><p>...</p>", "keyPoints": ["...", "..."], "tags": ["...", "..."], "imageQuery": "..."}`;
  }

  private async writeAndCreate(topic: Topic): Promise<boolean> {
    if (!(await this.budget.canSpend(estimateTextCostUsd(WRITE_MAX_TOKENS)))) return false;

    try {
      const text = await generateText(this.aiKeys, this.articlePrompt(topic), WRITE_MAX_TOKENS);
      await this.budget.recordSpend(estimateTextCostUsd(WRITE_MAX_TOKENS));
      const draft = JSON.parse(extractJSON(text)) as Record<string, unknown>;
      const title = String(draft.title ?? topic.title);
      const content = String(draft.content ?? '');
      if (!title || !content) return false;
      const tags = Array.isArray(draft.tags) ? draft.tags.map((t) => String(t)) : [];

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
      this.logger.warn(`Write failed for "${topic.title}": ${err instanceof Error ? err.message : err}`);
      return false;
    }
  }

  // Proposes `count` new tutorial topics and writes/publishes each one,
  // pacing calls with a delay. Used by both the hourly cron (count=1) and
  // the one-off bulk seed script (count=30).
  async topUp(count: number): Promise<number> {
    const existing = await this.existingTitles();
    const topics = await this.proposeTopics(count, existing);
    let created = 0;
    for (const topic of topics) {
      const ok = await this.writeAndCreate(topic);
      if (ok) {
        created += 1;
        this.logger.log(`Silver AI Bootcamp: posted "${topic.title}"`);
      }
      await sleep(2500);
    }
    return created;
  }
}
