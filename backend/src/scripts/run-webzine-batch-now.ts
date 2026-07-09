/**
 * Manually triggers the full production daily-batch pipeline (keyword
 * research -> news collection -> AI article writing -> cover image
 * generation -> publish with seeded views/likes/comments) without waiting
 * for the 4am KST cron. Uses the real NestJS DI graph (WebzineModule +
 * BlogModule) so this exercises the exact same code path as production.
 *
 * Run: npx ts-node -r dotenv/config src/scripts/run-webzine-batch-now.ts
 */
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { FirebaseModule } from '../firebase/firebase.module';
import { WebzineModule } from '../webzine/webzine.module';
import { WebzineSchedulerService } from '../webzine/webzine-scheduler.service';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), FirebaseModule, WebzineModule],
})
class BatchRunnerModule {}

async function main() {
  const app = await NestFactory.createApplicationContext(BatchRunnerModule, {
    logger: ['log', 'warn', 'error'],
  });
  try {
    const scheduler = app.get(WebzineSchedulerService);
    const result = await scheduler.runDailyBatch();
    console.log(`Done. Created ${result.created}/${result.attempted} articles.`);
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
