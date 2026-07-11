import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FirebaseService } from '../firebase/firebase.service';
import { BlogService } from '../blog/blog.service';
import { NewsCollectorService } from './news-collector.service';
import { ArticleWriterService } from './article-writer.service';
import { ImageGeneratorService } from './image-generator.service';
import { TrendingKeywordsService } from './trending-keywords.service';
import { findCategory } from './webzine.constants';

const TOP_N = 10;
const DELAY_BETWEEN_CALLS_MS = 2500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

// Slugify just for a stable Firestore doc ID — not a URL slug.
function docIdFor(date: string, keyword: string): string {
  const safe = keyword.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 80);
  return `${date}_${safe}`;
}

// Watches the real-time trending-keywords feed and writes an article for
// the highest-ranked of the current top 10 that hasn't already been covered
// today — runs once per hour, capped at one article per run (per the user's
// explicit request to slow the trending category down to one post/hour),
// independent of the once-daily 4am KST batch in WebzineSchedulerService.
const MAX_ARTICLES_PER_RUN = 1;

@Injectable()
export class TrendingArticleService {
  private readonly logger = new Logger(TrendingArticleService.name);
  private running = false;

  constructor(
    private readonly firebase: FirebaseService,
    private readonly blog: BlogService,
    private readonly collector: NewsCollectorService,
    private readonly writer: ArticleWriterService,
    private readonly images: ImageGeneratorService,
    private readonly trending: TrendingKeywordsService,
  ) {}

  private get logCollection() {
    return this.firebase.collection('trending_keyword_log');
  }

  @Cron('0 * * * *')
  async handleCron(): Promise<void> {
    await this.checkAndWrite();
  }

  async checkAndWrite(): Promise<{ created: number; checked: number }> {
    if (this.running) return { created: 0, checked: 0 };
    this.running = true;
    let created = 0;
    let checked = 0;
    try {
      const category = findCategory('trending');
      if (!category) return { created: 0, checked: 0 };

      const keywords = await this.trending.getTrending();
      const date = todayDateString();

      for (const { title: keyword } of keywords.slice(0, TOP_N)) {
        if (created >= MAX_ARTICLES_PER_RUN) break;
        if (!keyword) continue;
        checked += 1;

        const logRef = this.logCollection.doc(docIdFor(date, keyword));
        const logSnap = await logRef.get();
        if (logSnap.exists) continue;

        try {
          const headlines = await this.collector.collect(keyword, 3);
          if (headlines.length === 0) {
            await logRef.set({ keyword, date, createdAt: new Date().toISOString(), skipped: true });
            continue;
          }

          const written = await this.writer.write(category, headlines);
          if (written?.title && written.content) {
            const coverImage = await this.images.generateCoverImage(written.title, written.imageQuery);
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
          await logRef.set({ keyword, date, createdAt: new Date().toISOString(), skipped: false });
        } catch (err) {
          this.logger.warn(
            `Trending article write failed for "${keyword}": ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        await sleep(DELAY_BETWEEN_CALLS_MS);
      }

      if (created > 0) this.logger.log(`Trending keyword scan: created ${created} article(s) from ${checked} checked.`);
      return { created, checked };
    } finally {
      this.running = false;
    }
  }
}
