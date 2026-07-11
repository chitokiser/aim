/**
 * One-off bulk seed: publishes COUNT distinct "silver-ai-bootcamp" (실버 AI부트캠프)
 * articles right away, instead of waiting for the once-per-hour cron to
 * trickle them out one at a time. Uses the same keyword-research -> news
 * collection -> AI writing -> cover image pipeline as the daily webzine
 * batch, just scoped to this one category.
 *
 * Run: npx ts-node -r dotenv/config src/scripts/seed-silver-ai-bootcamp-articles.ts
 */
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { FirebaseModule } from '../firebase/firebase.module';
import { WebzineModule } from '../webzine/webzine.module';
import { BlogModule } from '../blog/blog.module';
import { BlogService } from '../blog/blog.service';
import { NewsCollectorService } from '../webzine/news-collector.service';
import { ArticleWriterService } from '../webzine/article-writer.service';
import { ImageGeneratorService } from '../webzine/image-generator.service';
import { KeywordResearchService } from '../webzine/keyword-research.service';
import { WebzineConfigService } from '../webzine/webzine-config.service';
import { findCategory } from '../webzine/webzine.constants';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const COUNT = 30;
const DELAY_BETWEEN_CALLS_MS = 2500;
const CATEGORY_SLUG = 'silver-ai-bootcamp';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), FirebaseModule, WebzineModule, BlogModule],
})
class SeedRunnerModule {}

async function main() {
  const app = await NestFactory.createApplicationContext(SeedRunnerModule, { logger: ['warn', 'error'] });
  try {
    const blog = app.get(BlogService);
    const collector = app.get(NewsCollectorService);
    const writer = app.get(ArticleWriterService);
    const images = app.get(ImageGeneratorService);
    const keywordResearch = app.get(KeywordResearchService);
    const config = app.get(WebzineConfigService);

    const category = findCategory(CATEGORY_SLUG);
    if (!category) throw new Error(`Unknown category: ${CATEGORY_SLUG}`);

    console.log(`Researching ${COUNT} keywords for "${category.ko}"...`);
    const keywords = await keywordResearch.rankKeywords(category, COUNT);
    console.log(`Got ${keywords.length} keyword(s). Writing articles...\n`);

    let created = 0;
    for (const keyword of keywords) {
      try {
        const headlines = await collector.collect(keyword, 1);
        if (headlines.length === 0) {
          console.log(`[skip] "${keyword}" (no headlines found)`);
          await sleep(DELAY_BETWEEN_CALLS_MS);
          continue;
        }

        const written = await writer.write(category, headlines);
        if (written?.title && written.content) {
          const coverImage = await images.generateCoverImage(written.title, written.imageQuery);
          await blog.create({
            title: written.title,
            excerpt: written.excerpt,
            content: written.content,
            tags: written.tags,
            category: category.slug,
            keyPoints: written.keyPoints,
            sources: written.sources,
            coverImage: coverImage ?? undefined,
            aiGenerated: true,
            published: true,
          });
          created += 1;
          console.log(`[posted] ${written.title}`);
        } else {
          console.log(`[fail] "${keyword}" (writer returned no article)`);
        }
      } catch (err) {
        console.log(`[fail] "${keyword}": ${err instanceof Error ? err.message : String(err)}`);
      }
      await sleep(DELAY_BETWEEN_CALLS_MS);
    }

    await config.markRun(CATEGORY_SLUG);
    console.log(`\nDone. Created ${created}/${keywords.length} articles.`);
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
