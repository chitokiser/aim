import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BlogService } from '../blog/blog.service';
import type { BlogPost } from '../blog/blog.service';
import { NewsCollectorService } from './news-collector.service';
import { ArticleWriterService } from './article-writer.service';
import { WebzineConfigService } from './webzine-config.service';
import { CATEGORIES, findCategory } from './webzine.constants';

// ~4 runs/day per category, spread out by polling frequently and gating on
// last-run time rather than hardcoding 16 categories' worth of cron expressions.
const RUN_INTERVAL_MS = 6 * 60 * 60 * 1000;

@Injectable()
export class WebzineSchedulerService {
  private readonly logger = new Logger(WebzineSchedulerService.name);
  private running = false;

  constructor(
    private readonly blog: BlogService,
    private readonly collector: NewsCollectorService,
    private readonly writer: ArticleWriterService,
    private readonly config: WebzineConfigService,
  ) {}

  @Cron('*/15 * * * *')
  async handleCron(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const state = await this.config.getState();
      const now = Date.now();
      for (const category of CATEGORIES) {
        if (!state.enabled[category.slug]) continue;
        const last = state.lastRunAt[category.slug];
        const lastMs = last ? new Date(last).getTime() : 0;
        if (now - lastMs < RUN_INTERVAL_MS) continue;

        await this.runCategory(category.slug).catch((err) => {
          this.logger.error(
            `Webzine run failed for ${category.slug}: ${err instanceof Error ? err.message : String(err)}`,
          );
        });
      }
    } finally {
      this.running = false;
    }
  }

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

    return this.blog.create({
      title: written.title,
      excerpt: written.excerpt,
      content: written.content,
      tags: written.tags,
      category: slug,
      keyPoints: written.keyPoints,
      sources: written.sources,
      aiGenerated: true,
      published: false,
    });
  }
}
