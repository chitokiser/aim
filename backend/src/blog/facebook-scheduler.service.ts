import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { BlogService } from './blog.service';
import { FacebookService } from './facebook.service';

// New "silver-ai-bootcamp" posts already cross-post to Facebook immediately
// on creation (see blog.service.ts create()). This interval only works
// through the pre-existing backlog (posts created before Facebook was wired
// up), one at a time every 1.5 hours, per request — same slow, steady pace
// as the Blogger silver-ai-bootcamp cadence.
const INTERVAL_MS = 90 * 60 * 1000;
const CAP_PER_TICK = 1;

@Injectable()
export class FacebookSchedulerService {
  private readonly logger = new Logger(FacebookSchedulerService.name);
  private running = false;

  constructor(
    private readonly blog: BlogService,
    private readonly facebook: FacebookService,
  ) {}

  @Interval(INTERVAL_MS)
  async handleInterval(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      if (!this.facebook.isConfigured()) return;
      const candidates = await this.blog.listFacebookCandidates(CAP_PER_TICK);
      for (const post of candidates) {
        const result = await this.blog.backfillFacebookPost(post.id);
        this.logger.log(`Facebook backlog post "${post.title}": ${result.status}`);
      }
    } finally {
      this.running = false;
    }
  }
}
