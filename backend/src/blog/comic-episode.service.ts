import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { BloggerService } from './blogger.service';
import { WordPressService } from './wordpress.service';
import { FacebookService } from './facebook.service';
import { TumblrService } from './tumblr.service';

export interface ComicEpisodeDoc {
  id: string;
  episodeNumber: number;
  seriesName: string;
  title: string;
  imageUrl: string;
  createdAt: string;
  bloggerUrl: string | null;
  wordpressUrl: string | null;
  facebookUrl: string | null;
  tumblrUrl: string | null;
}

// Reuses the existing silver-ai-bootcamp Blogger/WordPress targets and the
// same Facebook Page/Tumblr blog as the other SNS pipelines — no separate
// account was set up for this comic series, per the user's request to post
// it to "all SNS" (i.e. the channels already wired up).
const BLOGGER_TARGET = 'silver-ai-bootcamp' as const;
const WORDPRESS_TARGET = 'silver' as const;

@Injectable()
export class ComicEpisodeService {
  private readonly logger = new Logger(ComicEpisodeService.name);

  constructor(
    private readonly firebase: FirebaseService,
    private readonly blogger: BloggerService,
    private readonly wordpress: WordPressService,
    private readonly facebook: FacebookService,
    private readonly tumblr: TumblrService,
  ) {}

  private get collection() {
    return this.firebase.collection('comic_episodes');
  }

  // Strictly ascending by episodeNumber (not createdAt) — episodes must post
  // in story order, and re-syncing the source folder could add them out of
  // upload order if older episodes are backfilled later.
  async listPending(limit: number): Promise<ComicEpisodeDoc[]> {
    const snap = await this.collection.orderBy('episodeNumber', 'asc').get();
    const docs = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as ComicEpisodeDoc)
      .filter((e) => !e.bloggerUrl || !e.wordpressUrl || !e.facebookUrl || !e.tumblrUrl);
    return docs.slice(0, limit);
  }

  async crossPostOne(episode: ComicEpisodeDoc): Promise<void> {
    const update: Partial<ComicEpisodeDoc> = {};
    const caption = `${episode.seriesName} ${episode.episodeNumber}화 - ${episode.title}`;

    if (!episode.bloggerUrl && this.blogger.isConfigured(BLOGGER_TARGET)) {
      const html = `<p><img src="${episode.imageUrl}" alt="${caption}" /></p>`;
      const url = await this.blogger.publish(BLOGGER_TARGET, caption, html);
      this.logger.log(`Comic episode -> Blogger: "${caption}" url=${url ?? 'FAILED'}`);
      if (url) update.bloggerUrl = url;
    }

    if (!episode.wordpressUrl && this.wordpress.isConfigured(WORDPRESS_TARGET)) {
      const html = `<p><img src="${episode.imageUrl}" alt="${caption}" /></p>`;
      const url = await this.wordpress.publish(WORDPRESS_TARGET, caption, html, episode.imageUrl);
      this.logger.log(`Comic episode -> WordPress: "${caption}" url=${url ?? 'FAILED'}`);
      if (url) update.wordpressUrl = url;
    }

    if (!episode.facebookUrl && this.facebook.isConfigured()) {
      const url = await this.facebook.publishPhoto(episode.imageUrl, caption);
      this.logger.log(`Comic episode -> Facebook: "${caption}" url=${url ?? 'FAILED'}`);
      if (url) update.facebookUrl = url;
    }

    if (!episode.tumblrUrl && this.tumblr.isConfigured()) {
      const url = await this.tumblr.publishPhoto(caption, episode.imageUrl);
      this.logger.log(`Comic episode -> Tumblr: "${caption}" url=${url ?? 'FAILED'}`);
      if (url) update.tumblrUrl = url;
    }

    if (Object.keys(update).length > 0) {
      await this.collection.doc(episode.id).update(update);
    }
  }
}
