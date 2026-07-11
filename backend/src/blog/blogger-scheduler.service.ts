import { Injectable, Logger } from '@nestjs/common';
import { Cron, Interval } from '@nestjs/schedule';
import { BlogService } from './blog.service';
import { BloggerService, type BloggerTarget } from './blogger.service';

// Keeps each Blogger blog in the "quality, not volume" range the account
// requested (5 posts/day) rather than cross-posting every article the
// webzine pipeline generates — the burst from the initial backfill got a
// blog's write access blocked (403) almost immediately.
const DAILY_CAP = 5;
const DELAY_BETWEEN_POSTS_MS = 90_000;
const MAX_CONSECUTIVE_FAILURES = 3;
// "trending" and "classics" run on the original (write-blocked) account and
// stay disabled below until access is confirmed restored.
const TARGETS: BloggerTarget[] = [];

// "silver-ai-bootcamp" runs on a separate, freshly created Google account/
// Cloud project, so a block on the old account can't affect it. Posts one
// article every 1.5 hours (rather than a daily batch), per request, to keep
// a slow, steady pace on the fresh account.
const SILVER_TARGET: BloggerTarget = 'silver-ai-bootcamp';
const SILVER_INTERVAL_MS = 90 * 60 * 1000;
const SILVER_CAP_PER_TICK = 1;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class BloggerSchedulerService {
  private readonly logger = new Logger(BloggerSchedulerService.name);
  private running = false;
  private silverRunning = false;

  constructor(
    private readonly blog: BlogService,
    private readonly blogger: BloggerService,
  ) {}

  // Once/day, after the 04:00 KST webzine batch so there's fresh content to
  // pick from. Only runs for TARGETS above (currently empty) — the original
  // "trending"/"classics" account is still write-blocked (403
  // PERMISSION_DENIED, confirmed via a live test post) and stays excluded
  // until access is confirmed restored.
  @Cron('0 6 * * *', { timeZone: 'Asia/Seoul' })
  async handleDailyCron(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      for (const target of TARGETS) {
        await this.runTarget(target, DAILY_CAP);
      }
    } finally {
      this.running = false;
    }
  }

  @Interval(SILVER_INTERVAL_MS)
  async handleSilverInterval(): Promise<void> {
    if (this.silverRunning) return;
    this.silverRunning = true;
    try {
      await this.runTarget(SILVER_TARGET, SILVER_CAP_PER_TICK);
    } finally {
      this.silverRunning = false;
    }
  }

  async runTarget(target: BloggerTarget, cap: number): Promise<{ posted: number }> {
    if (!this.blogger.isConfigured(target)) return { posted: 0 };

    const candidates = await this.blog.listBloggerCandidates(target, cap);
    let posted = 0;
    let consecutiveFailures = 0;

    for (const post of candidates) {
      const result = await this.blog.backfillBloggerPost(post.id);
      if (result.status === 'posted') {
        posted += 1;
        consecutiveFailures = 0;
      } else if (result.status === 'failed') {
        consecutiveFailures += 1;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          this.logger.warn(`Blogger "${target}" cross-post aborted after ${consecutiveFailures} consecutive failures.`);
          break;
        }
      }
      await sleep(DELAY_BETWEEN_POSTS_MS);
    }

    this.logger.log(`Blogger "${target}" daily cross-post: ${posted}/${candidates.length} posted.`);
    return { posted };
  }
}
