import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { BloggerService } from './blogger.service';
import { TumblrService } from './tumblr.service';

export interface SnsVideoDoc {
  id: string;
  relativePath: string;
  title: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  sizeBytes: number;
  createdAt: string;
  bloggerUrl: string | null;
  tumblrUrl: string | null;
  tumblrSkipReason: string | null;
  facebookUrl: string | null;
  wordpressUrl: string | null;
}

const BLOGGER_TARGET = 'silver-ai-bootcamp' as const;
// Tumblr's documented API upload limit — files over this fail every retry
// forever, so they're marked with tumblrSkipReason instead of left "pending"
// (which would otherwise permanently block the queue, since it's processed
// oldest-first one at a time).
const TUMBLR_MAX_SIZE_BYTES = 100 * 1024 * 1024;

// Cross-posts pre-uploaded videos (see sync-sns-videos-to-firebase.ts, a
// local-only script — Railway has no access to the source folder on the
// user's machine) to Blogger and Tumblr. Facebook/WordPress are wired for
// later: Facebook's Page token expired and WordPress.com's plan currently
// rejects video file uploads, so both stay null/skipped until those are
// resolved (see SNS-CHANNELS.md).
@Injectable()
export class SnsVideoService {
  private readonly logger = new Logger(SnsVideoService.name);

  constructor(
    private readonly firebase: FirebaseService,
    private readonly blogger: BloggerService,
    private readonly tumblr: TumblrService,
  ) {}

  private get collection() {
    return this.firebase.collection('sns_videos');
  }

  async listPending(limit: number): Promise<SnsVideoDoc[]> {
    const snap = await this.collection.orderBy('createdAt', 'asc').get();
    const docs = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as SnsVideoDoc)
      .filter((v) => !v.bloggerUrl || (!v.tumblrUrl && !v.tumblrSkipReason));
    return docs.slice(0, limit);
  }

  async crossPostOne(video: SnsVideoDoc): Promise<void> {
    const update: Partial<SnsVideoDoc> = {};

    if (!video.bloggerUrl && this.blogger.isConfigured(BLOGGER_TARGET)) {
      // Blogger's homepage/list view generates its preview snippet from the
      // post's leading text/image — a post that's just a bare <video> tag
      // gets no snippet at all, so it looks blank in the feed next to posts
      // with a text+image preview (the video itself still plays fine once
      // you open the post). The thumbnail <img> gives the list view a real
      // picture to show, and doubles as the video's poster frame.
      const thumbnail = video.thumbnailUrl
        ? `<p><img src="${video.thumbnailUrl}" alt="${video.title}" /></p>`
        : '';
      const posterAttr = video.thumbnailUrl ? ` poster="${video.thumbnailUrl}"` : '';
      const html = `${thumbnail}<p><video controls width="100%" src="${video.videoUrl}"${posterAttr}></video></p>`;
      const url = await this.blogger.publish(BLOGGER_TARGET, video.title, html);
      this.logger.log(`SNS video -> Blogger: "${video.title}" url=${url ?? 'FAILED'}`);
      if (url) update.bloggerUrl = url;
    }

    if (!video.tumblrUrl && !video.tumblrSkipReason && this.tumblr.isConfigured()) {
      if (video.sizeBytes > TUMBLR_MAX_SIZE_BYTES) {
        update.tumblrSkipReason = `too large (${(video.sizeBytes / 1024 / 1024).toFixed(0)}MB > 100MB Tumblr limit)`;
        this.logger.log(`SNS video -> Tumblr: "${video.title}" skipped (${update.tumblrSkipReason})`);
      } else {
        const url = await this.publishVideoToTumblr(video.title, video.videoUrl);
        this.logger.log(`SNS video -> Tumblr: "${video.title}" url=${url ?? 'FAILED'}`);
        if (url) update.tumblrUrl = url;
      }
    }

    if (Object.keys(update).length > 0) {
      await this.collection.doc(video.id).update(update);
    }
  }

  private async publishVideoToTumblr(title: string, videoUrl: string): Promise<string | null> {
    try {
      const videoRes = await fetch(videoUrl);
      if (!videoRes.ok) return null;
      const buffer = Buffer.from(await videoRes.arrayBuffer());
      return this.tumblr.publishVideo(title, buffer);
    } catch (err) {
      this.logger.warn(`Fetching video from storage failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }
}
