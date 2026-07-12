import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ComicEpisodeService } from './comic-episode.service';

// One episode per day, posted to every configured channel at once — per
// request ("하루에 하나씩 모든 SNS에"). New episodes just need to be dropped
// into the source folder and re-synced (sync-comic-episodes-to-firebase.ts);
// they queue up here in strict episode-number order.
const INTERVAL_MS = 24 * 60 * 60 * 1000;
const CAP_PER_TICK = 1;

@Injectable()
export class ComicSchedulerService {
  private readonly logger = new Logger(ComicSchedulerService.name);
  private running = false;

  constructor(private readonly comic: ComicEpisodeService) {}

  @Interval(INTERVAL_MS)
  async handleInterval(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const pending = await this.comic.listPending(CAP_PER_TICK);
      for (const episode of pending) {
        this.logger.log(`Cross-posting comic episode ${episode.episodeNumber}: "${episode.title}"`);
        await this.comic.crossPostOne(episode);
      }
    } finally {
      this.running = false;
    }
  }
}
