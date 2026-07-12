/**
 * One-off: cross-posts the next unposted comic episode (in order) right
 * away, instead of waiting for ComicSchedulerService's 24h interval — used
 * to kick off a series immediately with episode 1 as a first test.
 *
 * Run: npx ts-node -r dotenv/config src/scripts/backfill-comic-episode-one.ts
 */
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { FirebaseModule } from '../firebase/firebase.module';
import { BlogModule } from '../blog/blog.module';
import { ComicEpisodeService } from '../blog/comic-episode.service';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), FirebaseModule, BlogModule],
})
class ScriptModule {}

async function main() {
  const app = await NestFactory.createApplicationContext(ScriptModule, { logger: ['error', 'warn'] });
  try {
    const comic = app.get(ComicEpisodeService);
    const pending = await comic.listPending(1);
    if (pending.length === 0) {
      console.log('No pending episodes.');
      return;
    }
    const episode = pending[0];
    console.log(`Posting episode ${episode.episodeNumber}: "${episode.title}" (${episode.seriesName})`);
    await comic.crossPostOne(episode);
    console.log('Done.');
  } finally {
    await app.close();
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
