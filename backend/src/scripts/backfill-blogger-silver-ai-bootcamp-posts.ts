/**
 * One-time backfill: cross-posts published "silver-ai-bootcamp" (실버
 * AI부트캠프) blog articles to the linked Blogger blog, up to LIMIT per run
 * (same quality/content-length gate as BloggerSchedulerService's daily cron —
 * see BlogService.listBloggerCandidates). Safe to re-run on subsequent days
 * to keep working through the backlog: already cross-posted articles are
 * skipped via the blog_blogger_posts collection.
 *
 * Run: npx ts-node -r dotenv/config src/scripts/backfill-blogger-silver-ai-bootcamp-posts.ts
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

// A 3s interval got the original "trending" backfill's writes blocked (403)
// after ~12 posts on a brand-new OAuth project, and even a 90s pace didn't
// save that account long-term. Since this is a fresh account we don't want
// to lose too, keep LIMIT conservative rather than matching classics' 20.
const DELAY_MS = 90_000;
const MAX_CONSECUTIVE_FAILURES = 3;
const LIMIT = 5;

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

    if (!blogger.isConfigured('silver-ai-bootcamp')) {
      console.error('Blogger "silver-ai-bootcamp" target is not configured (missing BLOGGER_SILVER_* vars in .env).');
      process.exitCode = 1;
      return;
    }

    const posts = await blog.listBloggerCandidates('silver-ai-bootcamp', LIMIT);
    console.log(`Found ${posts.length} eligible "silver-ai-bootcamp" posts (published, unposted, long enough).`);

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
            `blocking writes. Check blogger.com and Google Cloud Console before re-running this script.`,
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
