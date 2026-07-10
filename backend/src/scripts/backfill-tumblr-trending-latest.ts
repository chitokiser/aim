/**
 * One-off backfill: cross-posts the most recent LIMIT published "trending"
 * (실시간 이슈) articles to Tumblr, newest first. Safe to re-run:
 * backfillTumblrPost skips anything already posted.
 *
 * Run: npx ts-node -r dotenv/config src/scripts/backfill-tumblr-trending-latest.ts
 */
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { FirebaseModule } from '../firebase/firebase.module';
import { BlogModule } from '../blog/blog.module';
import { BlogService } from '../blog/blog.service';
import { TumblrService } from '../blog/tumblr.service';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DELAY_MS = 30_000;
const MAX_CONSECUTIVE_FAILURES = 3;
const LIMIT = 20;
const MIN_CONTENT_LENGTH = 800;

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), FirebaseModule, BlogModule],
})
class ScriptModule {}

async function main() {
  const app = await NestFactory.createApplicationContext(ScriptModule, { logger: ['error', 'warn'] });
  try {
    const blog = app.get(BlogService);
    const tumblr = app.get(TumblrService);

    if (!tumblr.isConfigured()) {
      console.error('Tumblr is not configured (missing TUMBLR_* vars in .env).');
      process.exitCode = 1;
      return;
    }

    const all = await blog.listAll(); // already sorted newest-first by createdAt
    const posts = all
      .filter((p) => p.published && p.category === 'trending' && stripHtml(p.content).length >= MIN_CONTENT_LENGTH)
      .slice(0, LIMIT);

    console.log(`Found ${posts.length} recent "trending" posts to attempt (newest first).`);

    let posted = 0;
    let alreadyPosted = 0;
    let consecutiveFailures = 0;
    for (const post of posts) {
      const result = await blog.backfillTumblrPost(post.id);
      if (result.status === 'posted') {
        posted += 1;
        consecutiveFailures = 0;
        console.log(`[posted] ${post.title} -> ${result.url}`);
      } else if (result.status === 'already-posted') {
        alreadyPosted += 1;
        console.log(`[skip] ${post.title} (already cross-posted)`);
      } else if (result.status === 'not-applicable') {
        console.log(`[skip] ${post.title} (not a trending-category post)`);
      } else {
        consecutiveFailures += 1;
        console.log(`[fail] ${post.title}`);
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          console.error(
            `\nAborting after ${consecutiveFailures} consecutive failures — Tumblr is likely rate-limiting or ` +
            `blocking writes. Check the blog dashboard before re-running this script.`,
          );
          break;
        }
      }
      await sleep(DELAY_MS);
    }
    console.log(`\nDone. Posted ${posted}, already posted ${alreadyPosted}.`);
  } finally {
    await app.close();
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
