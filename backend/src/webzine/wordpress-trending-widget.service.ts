import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { TrendingKeywordsService } from './trending-keywords.service';

// WordPress.com's Simple-plan sites strip <script> and <iframe> from Custom
// HTML blocks (no unfiltered_html capability), so a client-side live widget
// isn't possible there. Instead this pushes a static, server-rendered ranking
// list straight into the "home" block template every 15 minutes — same
// refresh cadence as the client-side widget would have used, just driven
// from our side instead of the visitor's browser.
const TEMPLATE_ID = 'pub/hall//home';
const WIDGET_START = '<!--TRENDING_WIDGET_START-->';
const WIDGET_END = '<!--TRENDING_WIDGET_END-->';
const UPDATED_START = '<!--TRENDING_UPDATED_AT-->';
const UPDATED_END = '<!--/TRENDING_UPDATED_AT-->';

@Injectable()
export class WordPressTrendingWidgetService {
  private readonly logger = new Logger(WordPressTrendingWidgetService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly trending: TrendingKeywordsService,
  ) {}

  private get site(): string | undefined {
    return this.config.get<string>('WORDPRESS_TRENDING_SITE');
  }

  private get token(): string | undefined {
    return this.config.get<string>('WORDPRESS_TRENDING_ACCESS_TOKEN');
  }

  @Cron('3,18,33,48 * * * *')
  async handleCron(): Promise<void> {
    // Disabled: jung1922a-jrzuy.wordpress.com has been suspended by
    // WordPress.com (confirmed: the live site returns HTTP 410 to visitors,
    // and the API returns "This site has been suspended") — not just a
    // write-endpoint block. Re-enable once the site is confirmed restored.
    return;
    // eslint-disable-next-line no-unreachable
    if (!this.site || !this.token) return;
    try {
      await this.refresh();
    } catch (err) {
      this.logger.warn(`Trending widget refresh failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async refresh(): Promise<void> {
    const keywords = await this.trending.getTrending();
    if (keywords.length === 0) return;

    const listHtml = keywords
      .slice(0, 10)
      .map(
        (k, i) =>
          `<li style="display:flex;gap:0.5rem;padding:0.3rem 0;border-bottom:1px solid rgba(0,0,0,0.05);align-items:center;"><span style="font-weight:700;min-width:1.25rem;color:#933c1f;">${i + 1}</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${this.escape(k.title)}</span></li>`,
      )
      .join('');

    const updatedAt = `${new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date())} KST`;

    const template = await this.getTemplate();
    if (!template) return;

    if (!template.includes(WIDGET_START) || !template.includes(WIDGET_END)) {
      this.logger.warn('Trending widget markers not found in home template — skipping update.');
      return;
    }

    let updated = this.replaceBetween(template, WIDGET_START, WIDGET_END, listHtml);
    updated = this.replaceBetween(updated, UPDATED_START, UPDATED_END, updatedAt);

    if (updated === template) return; // nothing changed, skip the write

    const ok = await this.putTemplate(updated);
    if (ok) {
      this.logger.log(`Trending widget updated on WordPress home template (${keywords.length} keywords).`);
    }
  }

  private async getTemplate(): Promise<string | null> {
    try {
      const res = await fetch(
        `https://public-api.wordpress.com/wp/v2/sites/${encodeURIComponent(this.site!)}/templates/${encodeURIComponent(TEMPLATE_ID)}`,
        { headers: { Authorization: `Bearer ${this.token}` } },
      );
      if (!res.ok) {
        this.logger.warn(`Failed to fetch home template (${res.status})`);
        return null;
      }
      const data = (await res.json()) as { content?: { raw?: string } };
      return data.content?.raw ?? null;
    } catch (err) {
      this.logger.warn(`Error fetching home template: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  private async putTemplate(content: string): Promise<boolean> {
    try {
      const res = await fetch(
        `https://public-api.wordpress.com/wp/v2/sites/${encodeURIComponent(this.site!)}/templates/${encodeURIComponent(TEMPLATE_ID)}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        },
      );
      if (!res.ok) {
        this.logger.warn(`Failed to update home template (${res.status}): ${await res.text()}`);
        return false;
      }
      return true;
    } catch (err) {
      this.logger.warn(`Error updating home template: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  private replaceBetween(content: string, start: string, end: string, replacement: string): string {
    const startIdx = content.indexOf(start);
    const endIdx = content.indexOf(end);
    if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return content;
    return content.slice(0, startIdx + start.length) + replacement + content.slice(endIdx);
  }

  private escape(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
