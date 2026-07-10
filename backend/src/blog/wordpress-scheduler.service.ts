import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BlogService } from './blog.service';
import { WordPressService, type WordPressTarget } from './wordpress.service';

// Same cap/pacing rationale as BloggerSchedulerService: avoid bursting a
// site's write API and tripping abuse detection. Runs an hour after the
// Blogger cron (06:00 KST) so the two integrations never compete for the
// same Firestore read pass.
//
// "trending" is capped at 1/day by design, not just caution: only the day's
// #1 Google Trends KR keyword article is ever a candidate for this target
// (see TREND_RANK1_TAG / resolveWordPressTarget in blog.service.ts), so 1 is
// the natural ceiling — classics/buddhist keep the general 5/day cap.
const DAILY_CAP: Record<WordPressTarget, number> = { trending: 1, classics: 5, buddhist: 5 };
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

    const candidates = await this.blog.listWordPressCandidates(target, DAILY_CAP[target]);
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
