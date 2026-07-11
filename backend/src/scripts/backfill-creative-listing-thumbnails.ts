/**
 * One-time backfill: regenerates a proper thumbnail (via ffmpeg, server-side)
 * for every "video" creative-market listing whose thumbnailUrl is missing or
 * is just the raw video link pasted into the thumbnail field (which renders
 * as a broken image — see VideoThumbnailService for why the client-side
 * capture silently fails for most real video sources).
 *
 * Run: npx ts-node -r dotenv/config src/scripts/backfill-creative-listing-thumbnails.ts
 */
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { FirebaseModule } from '../firebase/firebase.module';
import { FirebaseService } from '../firebase/firebase.service';
import { VideoThumbnailService } from '../creative-listings/video-thumbnail.service';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtube\.com\/embed\/|youtu\.be\/)([\w-]{11})/);
  return match ? match[1] : null;
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), FirebaseModule],
  providers: [VideoThumbnailService],
})
class ScriptModule {}

async function main() {
  const app = await NestFactory.createApplicationContext(ScriptModule, { logger: ['error', 'warn'] });
  try {
    const firebase = app.get(FirebaseService);
    const videoThumbnail = app.get(VideoThumbnailService);

    const snap = await firebase.collection('creative_listings')
      .where('status', '==', 'active')
      .where('contentType', '==', 'video')
      .get();

    const broken = snap.docs.filter((d) => {
      const data = d.data();
      const thumb = (data.thumbnailUrl as string | undefined)?.trim() ?? '';
      return !thumb || thumb === data.link;
    });

    console.log(`Found ${broken.length} video listing(s) with a missing/broken thumbnail.`);

    let fixed = 0;
    let failed = 0;
    for (const doc of broken) {
      const data = doc.data();
      process.stdout.write(`Generating: "${data.title}" ... `);
      const ytId = extractYouTubeId(data.link as string);
      const thumbnailUrl = ytId
        ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
        : await videoThumbnail.generate(data.link as string);
      if (thumbnailUrl) {
        await doc.ref.update({ thumbnailUrl });
        console.log('[OK]');
        fixed += 1;
      } else {
        console.log('[FAIL] (video source likely blocks direct ffmpeg access too)');
        failed += 1;
      }
    }

    console.log(`\nDone. Fixed ${fixed}, failed ${failed}.`);
  } finally {
    await app.close();
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
