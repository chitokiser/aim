import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { BlogService } from './blog.service';
import { TumblrService } from './tumblr.service';

// Tumblr now runs on a fresh app (the old one was blocked — 401 "Unable to
// authorize"), so unlike Facebook this is kept off the immediate-publish
// path entirely: every post, new or backlog, is cleared one at a time every
// 1.5 hours here, matching Blogger's and WordPress's silver-ai-bootcamp
// cadence, to keep a slow, steady pace on the new app.
const INTERVAL_MS = 90 * 60 * 1000;
const CAP_PER_TICK = 1;

@Injectable()
export class TumblrSchedulerService {
  private readonly logger = new Logger(TumblrSchedulerService.name);
  private running = false;

  constructor(
    private readonly blog: BlogService,
    private readonly tumblr: TumblrService,
  ) {}

  @Interval(INTERVAL_MS)
  async handleInterval(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      if (!this.tumblr.isConfigured()) return;
      const candidates = await this.blog.listTumblrCandidates(CAP_PER_TICK);
      for (const post of candidates) {
        const result = await this.blog.backfillTumblrPost(post.id);
        this.logger.log(`Tumblr backlog post "${post.title}": ${result.status}`);
      }
    } finally {
      this.running = false;
    }
  }
}
