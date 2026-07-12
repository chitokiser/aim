import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import OAuth from 'oauth-1.0a';

interface TumblrCredentials {
  consumerKey?: string;
  consumerSecret?: string;
  accessToken?: string;
  accessTokenSecret?: string;
  blogName?: string;
}

// Tumblr API v2 uses OAuth 1.0a (unlike WordPress.com's OAuth2), so every
// request needs an HMAC-SHA1 signature computed per-request rather than a
// static bearer token. Credentials are obtained once via
// bots/setup_tumblr_auth.py and never expire unless revoked.
@Injectable()
export class TumblrService {
  private readonly logger = new Logger(TumblrService.name);
  private readonly creds: TumblrCredentials;
  private readonly oauth: OAuth;

  constructor(private readonly config: ConfigService) {
    this.creds = {
      consumerKey: this.config.get<string>('TUMBLR_CONSUMER_KEY'),
      consumerSecret: this.config.get<string>('TUMBLR_CONSUMER_SECRET'),
      accessToken: this.config.get<string>('TUMBLR_ACCESS_TOKEN'),
      accessTokenSecret: this.config.get<string>('TUMBLR_ACCESS_TOKEN_SECRET'),
      blogName: this.config.get<string>('TUMBLR_BLOG_NAME'),
    };
    this.oauth = new OAuth({
      consumer: { key: this.creds.consumerKey ?? '', secret: this.creds.consumerSecret ?? '' },
      signature_method: 'HMAC-SHA1',
      hash_function(baseString, key) {
        return crypto.createHmac('sha1', key).update(baseString).digest('base64');
      },
    });
  }

  isConfigured(): boolean {
    const c = this.creds;
    return Boolean(c.consumerKey && c.consumerSecret && c.accessToken && c.accessTokenSecret && c.blogName);
  }

  /**
   * Publishes a text post to the configured Tumblr blog. Fire-and-forget from
   * callers: never throws. Returns the published post URL, or null on
   * failure/not configured.
   */
  async publish(title: string, htmlContent: string): Promise<string | null> {
    if (!this.isConfigured()) return null;

    const url = `https://api.tumblr.com/v2/blog/${encodeURIComponent(this.creds.blogName!)}/post`;
    const data = { type: 'text', title, body: htmlContent, state: 'published' };

    const token = { key: this.creds.accessToken!, secret: this.creds.accessTokenSecret! };
    const authHeader = this.oauth.toHeader(this.oauth.authorize({ url, method: 'POST', data }, token));

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          ...authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(data),
      });

      // Tumblr post IDs exceed JS's safe-integer range, so the numeric `id`
      // field loses precision through JSON parsing — `id_string` is the same
      // ID as a string and must be used instead when building URLs/records.
      const json = (await res.json().catch(() => null)) as
        | { response?: { id?: number; id_string?: string }; meta?: { status?: number; msg?: string } }
        | null;

      if (!res.ok || !json?.response?.id_string) {
        this.logger.warn(`Tumblr publish failed for "${title}" (${res.status}): ${JSON.stringify(json)}`);
        return null;
      }

      return `https://${this.creds.blogName}/post/${json.response.id_string}`;
    } catch (err) {
      this.logger.warn(`Tumblr publish error for "${title}": ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  /**
   * Publishes a video post to the configured Tumblr blog. Tumblr's video post
   * type needs the actual file bytes — a bare external URL via the `embed`
   * field was tested and rejected ("Posting failed") — so callers must fetch
   * the file themselves and pass the buffer here. Fire-and-forget: never
   * throws. Returns the published post URL, or null on failure/not configured.
   */
  async publishVideo(caption: string, videoBuffer: Buffer): Promise<string | null> {
    if (!this.isConfigured()) return null;

    const url = `https://api.tumblr.com/v2/blog/${encodeURIComponent(this.creds.blogName!)}/post`;
    const token = { key: this.creds.accessToken!, secret: this.creds.accessTokenSecret! };
    const signedParams = { type: 'video', caption, state: 'published' };
    const authHeader = this.oauth.toHeader(this.oauth.authorize({ url, method: 'POST', data: signedParams }, token));

    const form = new FormData();
    form.append('type', 'video');
    form.append('caption', caption);
    form.append('state', 'published');
    form.append('data', new Blob([new Uint8Array(videoBuffer)]), 'video.mp4');

    try {
      const res = await fetch(url, { method: 'POST', headers: { ...authHeader }, body: form });
      const json = (await res.json().catch(() => null)) as
        | { response?: { id?: number; id_string?: string }; meta?: { status?: number; msg?: string } }
        | null;

      if (!res.ok || !json?.response?.id_string) {
        this.logger.warn(`Tumblr video publish failed for "${caption}" (${res.status}): ${JSON.stringify(json)}`);
        return null;
      }

      return `https://${this.creds.blogName}/post/${json.response.id_string}`;
    } catch (err) {
      this.logger.warn(`Tumblr video publish error for "${caption}": ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  /**
   * Publishes a photo post to the configured Tumblr blog. Unlike video,
   * Tumblr's photo post type accepts a `source` URL directly and fetches it
   * server-side, so no local re-upload is needed here. Fire-and-forget: never
   * throws. Returns the published post URL, or null on failure/not configured.
   */
  async publishPhoto(caption: string, imageUrl: string): Promise<string | null> {
    if (!this.isConfigured()) return null;

    const url = `https://api.tumblr.com/v2/blog/${encodeURIComponent(this.creds.blogName!)}/post`;
    const data = { type: 'photo', caption, source: imageUrl, state: 'published' };

    const token = { key: this.creds.accessToken!, secret: this.creds.accessTokenSecret! };
    const authHeader = this.oauth.toHeader(this.oauth.authorize({ url, method: 'POST', data }, token));

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(data),
      });
      const json = (await res.json().catch(() => null)) as
        | { response?: { id?: number; id_string?: string }; meta?: { status?: number; msg?: string } }
        | null;

      if (!res.ok || !json?.response?.id_string) {
        this.logger.warn(`Tumblr photo publish failed for "${caption}" (${res.status}): ${JSON.stringify(json)}`);
        return null;
      }

      return `https://${this.creds.blogName}/post/${json.response.id_string}`;
    } catch (err) {
      this.logger.warn(`Tumblr photo publish error for "${caption}": ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }
}
