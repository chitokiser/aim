/**
 * One-off bulk seed: publishes COUNT distinct "실버 AI부트캠프" (Silver AI
 * Bootcamp) practical-skill tutorials right away, instead of waiting for the
 * once-per-hour cron to trickle them out one at a time.
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
import { SilverAiBootcampService } from '../webzine/silver-ai-bootcamp.service';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const COUNT = 30;

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), FirebaseModule, WebzineModule, BlogModule],
})
class SeedRunnerModule {}

async function main() {
  const app = await NestFactory.createApplicationContext(SeedRunnerModule, { logger: ['log', 'warn', 'error'] });
  try {
    const service = app.get(SilverAiBootcampService);
    const created = await service.topUp(COUNT);
    console.log(`\nDone. Created ${created}/${COUNT} tutorials.`);
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
