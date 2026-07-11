import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface FacebookCredentials {
  pageId?: string;
  pageAccessToken?: string;
}

const GRAPH_VERSION = 'v21.0';

// Facebook Graph API uses a static long-lived Page Access Token (unlike
// Tumblr's per-request OAuth1 signing), obtained once via
// bots/setup_facebook_auth.py and stored in FACEBOOK_PAGE_ACCESS_TOKEN. It
// does not expire unless the app's access to the Page is revoked.
@Injectable()
export class FacebookService {
  private readonly logger = new Logger(FacebookService.name);
  private readonly creds: FacebookCredentials;

  constructor(private readonly config: ConfigService) {
    this.creds = {
      pageId: this.config.get<string>('FACEBOOK_PAGE_ID'),
      pageAccessToken: this.config.get<string>('FACEBOOK_PAGE_ACCESS_TOKEN'),
    };
  }

  isConfigured(): boolean {
    return Boolean(this.creds.pageId && this.creds.pageAccessToken);
  }

  /**
   * Publishes a plain text post (the full article body, not a link preview
   * card) to the configured Facebook Page. Fire-and-forget from callers:
   * never throws. Returns the published post URL, or null on failure/not
   * configured.
   */
  async publish(message: string): Promise<string | null> {
    if (!this.isConfigured()) return null;

    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${this.creds.pageId}/feed`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          message,
          access_token: this.creds.pageAccessToken!,
        }),
      });

      const json = (await res.json().catch(() => null)) as
        | { id?: string; error?: { message?: string } }
        | null;

      if (!res.ok || !json?.id) {
        this.logger.warn(`Facebook publish failed: ${JSON.stringify(json)}`);
        return null;
      }

      // Facebook returns "{page-id}_{post-id}" as the combined id.
      const postId = json.id.split('_')[1] ?? json.id;
      return `https://www.facebook.com/${this.creds.pageId}/posts/${postId}`;
    } catch (err) {
      this.logger.warn(`Facebook publish error: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }
}
