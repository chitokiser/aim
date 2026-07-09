import { Injectable, Logger } from '@nestjs/common';
import Parser from 'rss-parser';

export interface TrendingKeyword {
  title: string;
  traffic?: string;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
// Google moved this from /trends/trendingsearches/daily/rss (removed) to
// /trending/rss as part of the "Trending Now" redesign.
const FEED_URL = 'https://trends.google.com/trending/rss?geo=KR';

// Google Trends' daily trending-searches RSS feed — same rss-parser
// dependency already used for the Google News collector. Cached in memory
// since the feed only refreshes a few times a day upstream; there's no
// point re-fetching on every page view.
@Injectable()
export class TrendingKeywordsService {
  private readonly logger = new Logger(TrendingKeywordsService.name);
  private cache: { data: TrendingKeyword[]; fetchedAt: number } | null = null;

  async getTrending(): Promise<TrendingKeyword[]> {
    if (this.cache && Date.now() - this.cache.fetchedAt < CACHE_TTL_MS) {
      return this.cache.data;
    }

    try {
      const parser = new Parser({
        customFields: { item: [['ht:approx_traffic', 'traffic']] },
      });
      const feed = await parser.parseURL(FEED_URL);
      const data: TrendingKeyword[] = (feed.items ?? [])
        .map((item) => ({
          title: (item.title ?? '').trim(),
          traffic: (item as unknown as { traffic?: string }).traffic,
        }))
        .filter((k) => k.title)
        .slice(0, 20);

      this.cache = { data, fetchedAt: Date.now() };
      return data;
    } catch (err) {
      this.logger.warn(`Failed to fetch Google Trends: ${err instanceof Error ? err.message : String(err)}`);
      return this.cache?.data ?? [];
    }
  }
}
