import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { SnsVideoService } from './sns-video.service';

// One video every 2 hours, cycling through the queue built by
// sync-sns-videos-to-firebase.ts (a local-only script — see its header for
// why this can't run from Railway directly).
const INTERVAL_MS = 2 * 60 * 60 * 1000;
const CAP_PER_TICK = 1;

@Injectable()
export class SnsVideoSchedulerService {
  private readonly logger = new Logger(SnsVideoSchedulerService.name);
  private running = false;

  constructor(private readonly snsVideo: SnsVideoService) {}

  @Interval(INTERVAL_MS)
  async handleInterval(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const pending = await this.snsVideo.listPending(CAP_PER_TICK);
      for (const video of pending) {
        this.logger.log(`Cross-posting SNS video: "${video.title}"`);
        await this.snsVideo.crossPostOne(video);
      }
    } finally {
      this.running = false;
    }
  }
}
