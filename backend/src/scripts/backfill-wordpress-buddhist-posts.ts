/**
 * One-time backfill: cross-posts published "classics" (고전읽기) articles
 * tagged 불교철학 (see seed-buddhist-philosophy.ts) to the dedicated Buddhist
 * philosophy WordPress.com site, up to LIMIT per run (same quality/content-length
 * gate as WordPressSchedulerService's daily cron — see BlogService.listWordPressCandidates
 * / resolveWordPressTarget). Safe to re-run: already cross-posted articles are
 * skipped via the blog_wordpress_posts collection.
 *
 * Run: npx ts-node -r dotenv/config src/scripts/backfill-wordpress-buddhist-posts.ts
 */
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { FirebaseModule } from '../firebase/firebase.module';
import { BlogModule } from '../blog/blog.module';
import { BlogService } from '../blog/blog.service';
import { WordPressService } from '../blog/wordpress.service';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DELAY_MS = 90_000;
const MAX_CONSECUTIVE_FAILURES = 3;
// One-off push of the full initial 30-article batch.
const LIMIT = 30;

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
    const wordpress = app.get(WordPressService);

    if (!wordpress.isConfigured('buddhist')) {
      console.error('WordPress "buddhist" target is not configured (missing WORDPRESS_BUDDHIST_* vars in .env).');
      process.exitCode = 1;
      return;
    }

    const posts = await blog.listWordPressCandidates('buddhist', LIMIT);
    console.log(`Found ${posts.length} eligible "buddhist" posts (published, unposted, long enough).`);

    let posted = 0;
    let alreadyPosted = 0;
    let consecutiveFailures = 0;
    for (const post of posts) {
      const result = await blog.backfillWordPressPost(post.id);
      if (result.status === 'posted') {
        posted += 1;
        consecutiveFailures = 0;
        console.log(`[posted] ${post.title} -> ${result.url}`);
      } else if (result.status === 'already-posted') {
        alreadyPosted += 1;
        console.log(`[skip] ${post.title} (already cross-posted)`);
      } else if (result.status === 'not-applicable') {
        console.log(`[skip] ${post.title} (not tagged for the buddhist WordPress target)`);
      } else {
        consecutiveFailures += 1;
        console.log(`[fail] ${post.title}`);
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          console.error(
            `\nAborting after ${consecutiveFailures} consecutive failures — WordPress is likely rate-limiting or ` +
            `blocking writes. Check the site dashboard before re-running this script.`,
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
