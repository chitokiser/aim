import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Each target is a separate WordPress.com site with its own OAuth app, so a
// write-block on one site never affects the other. Maps 1:1 to blog_posts.category
// values that get cross-posted (mirrors BloggerTarget in blogger.service.ts).
export type WordPressTarget = 'trending' | 'classics';

interface WordPressCredentials {
  site?: string;
  accessToken?: string;
}

@Injectable()
export class WordPressService {
  private readonly logger = new Logger(WordPressService.name);
  private readonly targets: Record<WordPressTarget, WordPressCredentials>;

  constructor(private readonly config: ConfigService) {
    this.targets = {
      trending: this.loadCredentials('WORDPRESS_TRENDING'),
      classics: this.loadCredentials('WORDPRESS_CLASSICS'),
    };
  }

  private loadCredentials(envPrefix: string): WordPressCredentials {
    return {
      site: this.config.get<string>(`${envPrefix}_SITE`),
      accessToken: this.config.get<string>(`${envPrefix}_ACCESS_TOKEN`),
    };
  }

  isConfigured(target: WordPressTarget): boolean {
    const c = this.targets[target];
    return Boolean(c.site && c.accessToken);
  }

  /** Publishes a post to the given target's WordPress.com site. Fire-and-forget from callers: never throws. Returns the published post URL, or null on failure/not configured. */
  async publish(target: WordPressTarget, title: string, htmlContent: string): Promise<string | null> {
    if (!this.isConfigured(target)) return null;
    const c = this.targets[target];

    try {
      const res = await fetch(
        `https://public-api.wordpress.com/rest/v1.1/sites/${encodeURIComponent(c.site!)}/posts/new`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${c.accessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ title, content: htmlContent, status: 'publish' }),
        },
      );
      if (!res.ok) {
        this.logger.warn(`WordPress publish failed for "${title}" (${res.status}): ${await res.text()}`);
        return null;
      }
      const data = (await res.json()) as { URL?: string; status?: string };
      if (data.status && data.status !== 'publish') {
        this.logger.warn(`WordPress post "${title}" created with status=${data.status} (site may be holding it for review)`);
      }
      return data.URL ?? null;
    } catch (err) {
      this.logger.warn(`WordPress publish error for "${title}": ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }
}
