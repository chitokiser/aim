import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BlogService } from '../blog/blog.service';
import type { BlogPost } from '../blog/blog.service';
import { NewsCollectorService } from './news-collector.service';
import { ArticleWriterService } from './article-writer.service';
import { ImageGeneratorService } from './image-generator.service';
import { KeywordResearchService } from './keyword-research.service';
import { WebzineConfigService } from './webzine-config.service';
import { CATEGORIES, findCategory, type CategoryDef } from './webzine.constants';

// Target total core articles/day across all enabled categories combined.
const DAILY_TARGET = 50;
const DELAY_BETWEEN_CALLS_MS = 2500;

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Splits `total` as evenly as possible across `categories`, e.g. 40 across
// 16 categories -> eight get 3, eight get 2.
function distributeCounts(categories: CategoryDef[], total: number): Map<string, number> {
  const counts = new Map<string, number>();
  if (categories.length === 0) return counts;
  const base = Math.floor(total / categories.length);
  const remainder = total % categories.length;
  categories.forEach((c, i) => counts.set(c.slug, base + (i < remainder ? 1 : 0)));
  return counts;
}

@Injectable()
export class WebzineSchedulerService {
  private readonly logger = new Logger(WebzineSchedulerService.name);
  private running = false;

  constructor(
    private readonly blog: BlogService,
    private readonly collector: NewsCollectorService,
    private readonly writer: ArticleWriterService,
    private readonly images: ImageGeneratorService,
    private readonly keywords: KeywordResearchService,
    private readonly config: WebzineConfigService,
  ) {}

  // Runs once/day at 04:00 KST. A stored lastDailyBatchDate guards against
  // duplicate runs if the process restarts and the cron re-fires the same day.
  @Cron('0 4 * * *', { timeZone: 'Asia/Seoul' })
  async handleDailyCron(): Promise<void> {
    const state = await this.config.getState();
    if (state.lastDailyBatchDate === todayDateString()) return;
    await this.runDailyBatch();
  }

  async runDailyBatch(): Promise<{ created: number; attempted: number }> {
    if (this.running) return { created: 0, attempted: 0 };
    this.running = true;
    let created = 0;
    let attempted = 0;
    try {
      const state = await this.config.getState();
      const enabledCategories = CATEGORIES.filter((c) => state.enabled[c.slug]);
      const counts = distributeCounts(enabledCategories, DAILY_TARGET);

      for (const category of enabledCategories) {
        const target = counts.get(category.slug) ?? 0;
        if (target === 0) continue;

        const rankedKeywords = await this.keywords.rankKeywords(category, target);

        for (const keyword of rankedKeywords) {
          attempted += 1;
          try {
            const headlines = await this.collector.collect(keyword, 1);
            if (headlines.length === 0) continue;

            const written = await this.writer.write(category, headlines);
            if (written?.title && written.content) {
              const coverImage = await this.images.generateCoverImage(written.title);
              await this.blog.create({
                title: written.title,
                excerpt: written.excerpt,
                content: written.content,
                tags: written.tags,
                category: category.slug,
                keyPoints: written.keyPoints,
                sources: written.sources,
                coverImage: coverImage ?? undefined,
                aiGenerated: true,
                published: true,
              });
              created += 1;
            }
          } catch (err) {
            this.logger.warn(
              `Article write failed for ${category.slug} ("${keyword}"): ${err instanceof Error ? err.message : String(err)}`,
            );
          }
          await sleep(DELAY_BETWEEN_CALLS_MS);
        }

        await this.config.markRun(category.slug);
      }

      await this.config.markDailyBatch(todayDateString());
      this.logger.log(`Daily webzine batch: created ${created}/${attempted} articles.`);
      return { created, attempted };
    } finally {
      this.running = false;
    }
  }

  // Manual single-article trigger for the admin "지금 수집" button — picks
  // the single most newsworthy story from a wider pool of headlines,
  // separate from the daily batch's one-article-per-headline approach.
  async runCategory(slug: string): Promise<BlogPost | null> {
    const category = findCategory(slug);
    if (!category) throw new Error(`Unknown webzine category: ${slug}`);

    const articles = await this.collector.collect(category.searchQuery);
    const written = await this.writer.write(category, articles);
    await this.config.markRun(slug);

    if (!written || !written.title || !written.content) {
      this.logger.warn(`No article generated for category: ${slug}`);
      return null;
    }

    const coverImage = await this.images.generateCoverImage(written.title);
    return this.blog.create({
      title: written.title,
      excerpt: written.excerpt,
      content: written.content,
      tags: written.tags,
      category: slug,
      keyPoints: written.keyPoints,
      sources: written.sources,
      coverImage: coverImage ?? undefined,
      aiGenerated: true,
      published: true,
    });
  }
}
