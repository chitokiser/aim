/**
 * One-time backfill: cross-posts published "trending" (실시간 이슈) blog
 * articles to the linked Blogger blog, up to LIMIT per run (same
 * quality/content-length gate as BloggerSchedulerService's daily cron — see
 * BlogService.listBloggerCandidates). Safe to re-run on subsequent days to
 * keep working through the backlog: already cross-posted articles are
 * skipped via the blog_blogger_posts collection.
 *
 * Run: npx ts-node -r dotenv/config src/scripts/backfill-blogger-trending-posts.ts
 */
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { FirebaseModule } from '../firebase/firebase.module';
import { BlogModule } from '../blog/blog.module';
import { BlogService } from '../blog/blog.service';
import { BloggerService } from '../blog/blogger.service';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Blogger auto-locks a blog from further posting (403 PERMISSION_DENIED) if it
// sees a burst of automated posts — a 3s interval tripped this after ~12 posts.
// 90s keeps the pace close to how a human would actually post.
const DELAY_MS = 90_000;
const MAX_CONSECUTIVE_FAILURES = 3;
// Upper end of the requested 5–20 quality posts/day — this is a deliberate
// manual run, as opposed to the daily cron's more conservative DAILY_CAP.
const LIMIT = 20;

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
    const blogger = app.get(BloggerService);

    if (!blogger.isConfigured('trending')) {
      console.error('Blogger "trending" target is not configured (missing BLOGGER_TRENDING_* vars in .env).');
      process.exitCode = 1;
      return;
    }

    const posts = await blog.listBloggerCandidates('trending', LIMIT);
    console.log(`Found ${posts.length} eligible "trending" posts (published, unposted, long enough).`);

    let posted = 0;
    let alreadyPosted = 0;
    let consecutiveFailures = 0;
    for (const post of posts) {
      const result = await blog.backfillBloggerPost(post.id);
      if (result.status === 'posted') {
        posted += 1;
        consecutiveFailures = 0;
        console.log(`[posted] ${post.title} -> ${result.url}`);
      } else if (result.status === 'already-posted') {
        alreadyPosted += 1;
        console.log(`[skip] ${post.title} (already cross-posted)`);
      } else if (result.status === 'not-applicable') {
        console.log(`[skip] ${post.title} (category no longer maps to a Blogger target)`);
      } else {
        consecutiveFailures += 1;
        console.log(`[fail] ${post.title}`);
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          console.error(
            `\nAborting after ${consecutiveFailures} consecutive failures — Blogger is likely rate-limiting or ` +
            `spam-locking the blog. Check blogger.com for a lock/review banner before re-running this script.`,
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
