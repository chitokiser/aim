/**
 * One-time repair: fixes classics posts already cross-posted to WordPress.com
 * before the featured-image fix (blog.service.ts crossPostToWordPress) — those
 * posts have an oversized inline <img> in the body and no featured_image, so
 * archive/listing cards show no thumbnail. This re-edits each already-posted
 * WordPress post to: set featured_image from the source blog post's coverImage,
 * and rebuild the body without the old inline image (matching what a fresh
 * cross-post would produce now).
 *
 * Run: npx ts-node -r dotenv/config src/scripts/repair-wordpress-classics-images.ts
 */
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { FirebaseModule } from '../firebase/firebase.module';
import { FirebaseService } from '../firebase/firebase.service';
import { BlogModule } from '../blog/blog.module';
import { BlogService } from '../blog/blog.service';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DELAY_MS = 5_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), FirebaseModule, BlogModule],
})
class ScriptModule {}

interface WpPost {
  ID: number;
  URL: string;
}

async function main() {
  const app = await NestFactory.createApplicationContext(ScriptModule, { logger: ['error', 'warn'] });
  try {
    const firebase = app.get(FirebaseService);
    const blog = app.get(BlogService);
    const config = app.get(ConfigService);

    const site = config.get<string>('WORDPRESS_CLASSICS_SITE');
    const accessToken = config.get<string>('WORDPRESS_CLASSICS_ACCESS_TOKEN');
    if (!site || !accessToken) {
      console.error('WORDPRESS_CLASSICS_SITE / WORDPRESS_CLASSICS_ACCESS_TOKEN not set.');
      process.exitCode = 1;
      return;
    }
    const siteUrl = (config.get<string>('FRONTEND_URL') || 'https://ai119.netlify.app').replace(/\/+$/, '');

    // Build a wordpressUrl -> numeric post ID map from the live site.
    const listRes = await fetch(
      `https://public-api.wordpress.com/rest/v1.1/sites/${encodeURIComponent(site)}/posts/?number=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!listRes.ok) {
      console.error(`Failed to list WordPress posts (${listRes.status}): ${await listRes.text()}`);
      process.exitCode = 1;
      return;
    }
    const listData = (await listRes.json()) as { posts: WpPost[] };
    const urlToId = new Map(listData.posts.map((p) => [p.URL, p.ID]));

    const snapshot = await firebase.collection('blog_wordpress_posts').get();
    console.log(`Found ${snapshot.size} cross-posted WordPress records.`);

    let fixed = 0;
    let skipped = 0;
    for (const doc of snapshot.docs) {
      const record = doc.data() as { postId: string; wordpressUrl: string };
      const wpId = urlToId.get(record.wordpressUrl);
      if (!wpId) {
        console.log(`[skip] ${record.wordpressUrl} — not found in current WordPress post list`);
        skipped += 1;
        continue;
      }

      const post = await blog.getById(record.postId);
      const html = `${post.content}<p><a href="${siteUrl}/blog/${post.slug}">${siteUrl}/blog/${post.slug}</a></p>`;

      const params = new URLSearchParams({ content: html });
      if (post.coverImage) params.set('featured_image', post.coverImage);

      const editRes = await fetch(
        `https://public-api.wordpress.com/rest/v1.1/sites/${encodeURIComponent(site)}/posts/${wpId}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params,
        },
      );
      if (!editRes.ok) {
        console.log(`[fail] ${post.title} (${editRes.status}): ${await editRes.text()}`);
      } else {
        console.log(`[fixed] ${post.title}`);
        fixed += 1;
      }
      await sleep(DELAY_MS);
    }
    console.log(`\nDone. Fixed ${fixed}, skipped ${skipped}.`);
  } finally {
    await app.close();
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
