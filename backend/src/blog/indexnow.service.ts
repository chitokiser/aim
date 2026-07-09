import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

@Injectable()
export class IndexNowService {
  private readonly logger = new Logger(IndexNowService.name);
  private readonly key?: string;
  private readonly siteUrl: string;

  constructor(private readonly config: ConfigService) {
    this.key = this.config.get<string>('INDEXNOW_KEY');
    this.siteUrl = (this.config.get<string>('FRONTEND_URL') || 'https://ai119.netlify.app').replace(/\/+$/, '');
  }

  private isConfigured(): boolean {
    return Boolean(this.key);
  }

  /** Notifies IndexNow-participating search engines (Bing, Yandex, Naver, ...) about a new/updated URL. Fire-and-forget: never throws. */
  async submitUrl(path: string): Promise<void> {
    if (!this.isConfigured()) return;
    const url = `${this.siteUrl}${path.startsWith('/') ? path : `/${path}`}`;
    try {
      const res = await fetch(INDEXNOW_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          host: new URL(this.siteUrl).host,
          key: this.key,
          keyLocation: `${this.siteUrl}/${this.key}.txt`,
          urlList: [url],
        }),
      });
      if (!res.ok && res.status !== 202) {
        this.logger.warn(`IndexNow submit failed for ${url}: ${res.status}`);
      }
    } catch (err) {
      this.logger.warn(`IndexNow submit error for ${url}: ${err instanceof Error ? err.message : err}`);
    }
  }

  /** Batch variant for backfills/seed scripts submitting many URLs at once. */
  async submitUrls(paths: string[]): Promise<void> {
    if (!this.isConfigured() || paths.length === 0) return;
    const urlList = paths.map((path) => `${this.siteUrl}${path.startsWith('/') ? path : `/${path}`}`);
    try {
      const res = await fetch(INDEXNOW_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          host: new URL(this.siteUrl).host,
          key: this.key,
          keyLocation: `${this.siteUrl}/${this.key}.txt`,
          urlList,
        }),
      });
      if (!res.ok && res.status !== 202) {
        this.logger.warn(`IndexNow batch submit failed for ${urlList.length} URLs: ${res.status}`);
      }
    } catch (err) {
      this.logger.warn(`IndexNow batch submit error: ${err instanceof Error ? err.message : err}`);
    }
  }
}
