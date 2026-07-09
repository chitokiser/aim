/**
 * Backfills cover image, views, likes, comments, and hidden-TIGU-mascot
 * treasure roulette codes for existing blog posts that predate these being
 * seeded on create() — e.g. articles written by the older
 * seed-webzine-articles.ts script, which left coverImage: null, views: 0,
 * likes: 0, no comments, and no treasureCode.
 *
 * Run: npx ts-node -r dotenv/config src/scripts/backfill-blog-engagement.ts
 */
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { FirebaseModule } from '../firebase/firebase.module';
import { BlogModule } from '../blog/blog.module';
import { BlogService } from '../blog/blog.service';
import { WebzineModule } from '../webzine/webzine.module';
import { ImageGeneratorService } from '../webzine/image-generator.service';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DELAY_MS = 2000;
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), FirebaseModule, BlogModule, WebzineModule],
})
class BackfillModule {}

async function main() {
  const app = await NestFactory.createApplicationContext(BackfillModule, {
    logger: ['warn', 'error'],
  });
  try {
    const blog = app.get(BlogService);
    const images = app.get(ImageGeneratorService);

    const posts = await blog.listAll();
    console.log(`Found ${posts.length} total posts.`);

    let imagesAdded = 0;
    let engagementBackfilled = 0;
    let treasureCodesAdded = 0;

    for (const post of posts) {
      try {
        if (!post.coverImage) {
          const url = await images.generateCoverImage(post.title);
          if (url) {
            await blog.update(post.id, { coverImage: url });
            imagesAdded += 1;
            console.log(`  [image] ${post.title}`);
          } else {
            console.warn(`  [image skipped - generation failed] ${post.title}`);
          }
        }

        const result = await blog.backfillEngagement(post.id);
        if (result.viewsLikesSeeded || result.commentsAdded > 0) {
          engagementBackfilled += 1;
          console.log(
            `  [engagement] ${post.title} -> +${result.commentsAdded} comments, viewsLikesSeeded=${result.viewsLikesSeeded}`,
          );
        }

        const gotTreasureCode = await blog.backfillTreasureCode(post.id);
        if (gotTreasureCode) {
          treasureCodesAdded += 1;
          console.log(`  [treasure] ${post.title}`);
        }
      } catch (err) {
        console.error(`Failed for "${post.title}":`, err instanceof Error ? err.message : err);
      }
      await sleep(DELAY_MS);
    }

    console.log(
      `Done. Images added: ${imagesAdded}, engagement backfilled: ${engagementBackfilled}/${posts.length}, treasure codes added: ${treasureCodesAdded}/${posts.length}`,
    );
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
