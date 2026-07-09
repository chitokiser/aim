/**
 * One-off backfill: submits every already-published blog post's URL to
 * IndexNow in a single batch call, so Bing/Yandex/Naver can discover the
 * existing content immediately instead of waiting for their next own crawl.
 * Going forward, BlogService.create()/update() submit new/newly-published
 * posts automatically — this script only covers what existed before that
 * hook was added.
 *
 * Run: npx ts-node -r dotenv/config src/scripts/indexnow-submit-all.ts
 */
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { FirebaseModule } from '../firebase/firebase.module';
import { BlogModule } from '../blog/blog.module';
import { BlogService } from '../blog/blog.service';
import { IndexNowService } from '../blog/indexnow.service';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), FirebaseModule, BlogModule],
})
class IndexNowBackfillModule {}

async function main() {
  const app = await NestFactory.createApplicationContext(IndexNowBackfillModule, { logger: ['warn', 'error'] });
  try {
    const blog = app.get(BlogService);
    const indexNow = app.get(IndexNowService);

    const posts = await blog.listPublished();
    const paths = posts.map((p) => `/blog/${p.slug}`);
    console.log(`Submitting ${paths.length} published post URLs to IndexNow...`);
    await indexNow.submitUrls(paths);
    console.log('Done.');
  } finally {
    await app.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
