import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BlogService } from './blog.service';
import { WordPressService, type WordPressTarget } from './wordpress.service';

// BlogService.create() now cross-posts every WordPress target immediately, so
// this cron is a retry net for anything that failed at creation time (network
// blip, WordPress rate-limiting) rather than the primary publishing path —
// listWordPressCandidates only ever returns posts that never got a
// blog_wordpress_posts record, i.e. immediate publish didn't already handle it.
const DAILY_CAP = 5;
const DELAY_BETWEEN_POSTS_MS = 90_000;
const MAX_CONSECUTIVE_FAILURES = 3;
const TARGETS: WordPressTarget[] = ['trending', 'classics', 'buddhist'];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class WordPressSchedulerService {
  private readonly logger = new Logger(WordPressSchedulerService.name);
  private running = false;

  constructor(
    private readonly blog: BlogService,
    private readonly wordpress: WordPressService,
  ) {}

  @Cron('0 7 * * *', { timeZone: 'Asia/Seoul' })
  async handleDailyCron(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      for (const target of TARGETS) {
        await this.runTarget(target);
      }
    } finally {
      this.running = false;
    }
  }

  async runTarget(target: WordPressTarget): Promise<{ posted: number }> {
    if (!this.wordpress.isConfigured(target)) return { posted: 0 };

    const candidates = await this.blog.listWordPressCandidates(target, DAILY_CAP);
    let posted = 0;
    let consecutiveFailures = 0;

    for (const post of candidates) {
      const result = await this.blog.backfillWordPressPost(post.id);
      if (result.status === 'posted') {
        posted += 1;
        consecutiveFailures = 0;
      } else if (result.status === 'failed') {
        consecutiveFailures += 1;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          this.logger.warn(`WordPress "${target}" cross-post aborted after ${consecutiveFailures} consecutive failures.`);
          break;
        }
      }
      await sleep(DELAY_BETWEEN_POSTS_MS);
    }

    this.logger.log(`WordPress "${target}" daily cross-post: ${posted}/${candidates.length} posted.`);
    return { posted };
  }
}
