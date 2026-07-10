import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Each target is a separate Blogger blog with its own OAuth client, so a
// quota/write-block on one blog's Google Cloud project never affects the
// other. Maps 1:1 to blog_posts.category values that get cross-posted.
export type BloggerTarget = 'trending' | 'classics';

interface BloggerCredentials {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  blogId?: string;
}

@Injectable()
export class BloggerService {
  private readonly logger = new Logger(BloggerService.name);
  private readonly targets: Record<BloggerTarget, BloggerCredentials>;

  constructor(private readonly config: ConfigService) {
    this.targets = {
      trending: this.loadCredentials('BLOGGER_TRENDING'),
      classics: this.loadCredentials('BLOGGER_CLASSICS'),
    };
  }

  private loadCredentials(envPrefix: string): BloggerCredentials {
    return {
      clientId: this.config.get<string>(`${envPrefix}_CLIENT_ID`),
      clientSecret: this.config.get<string>(`${envPrefix}_CLIENT_SECRET`),
      refreshToken: this.config.get<string>(`${envPrefix}_REFRESH_TOKEN`),
      blogId: this.config.get<string>(`${envPrefix}_BLOG_ID`),
    };
  }

  isConfigured(target: BloggerTarget): boolean {
    const c = this.targets[target];
    return Boolean(c.clientId && c.clientSecret && c.refreshToken && c.blogId);
  }

  private async getAccessToken(c: BloggerCredentials): Promise<string | null> {
    if (!c.clientId || !c.clientSecret || !c.refreshToken) return null;
    try {
      const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: c.clientId,
          client_secret: c.clientSecret,
          refresh_token: c.refreshToken,
          grant_type: 'refresh_token',
        }),
      });
      if (!res.ok) {
        this.logger.error(`Blogger token refresh failed (${res.status}): ${await res.text()}`);
        return null;
      }
      const data = (await res.json()) as { access_token?: string };
      return data.access_token ?? null;
    } catch (err) {
      this.logger.error(`Blogger token refresh error: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  /** Publishes a post to the given target's Blogger blog. Fire-and-forget from callers: never throws. Returns the Blogger post URL, or null on failure/not configured. */
  async publish(target: BloggerTarget, title: string, htmlContent: string): Promise<string | null> {
    if (!this.isConfigured(target)) return null;
    const c = this.targets[target];
    const accessToken = await this.getAccessToken(c);
    if (!accessToken) return null;

    try {
      const res = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${c.blogId}/posts/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'blogger#post', title, content: htmlContent }),
      });
      if (!res.ok) {
        this.logger.warn(`Blogger publish failed for "${title}" (${res.status}): ${await res.text()}`);
        return null;
      }
      const data = (await res.json()) as { url?: string; status?: string };
      if (data.status && data.status !== 'LIVE') {
        this.logger.warn(`Blogger post "${title}" created with status=${data.status} (Blogger may be holding it for review)`);
      }
      return data.url ?? null;
    } catch (err) {
      this.logger.warn(`Blogger publish error for "${title}": ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }
}
