/**
 * Local-only sync: scans a local folder of comic episode images (named by
 * episode number, e.g. "1.png", "2.png", ...), uploads any not-yet-synced
 * ones to Firebase Storage, and creates a Firestore doc (collection
 * `comic_episodes`) so ComicSchedulerService can cross-post them to
 * Blogger/WordPress/Facebook/Tumblr in strict episode order, one per day.
 *
 * Safe to re-run whenever new episodes are dropped into the folder —
 * already-synced episode numbers are skipped.
 *
 * Run: npx ts-node -r dotenv/config src/scripts/sync-comic-episodes-to-firebase.ts "<folder path>" "<series name>"
 */
import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as dotenv from 'dotenv';
import { FirebaseModule } from '../firebase/firebase.module';
import { FirebaseService } from '../firebase/firebase.service';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

function findEpisodeFiles(root: string): { file: string; episodeNumber: number }[] {
  const results: { file: string; episodeNumber: number }[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) continue;
    const base = path.basename(entry.name, ext);
    const num = Number(base);
    if (!Number.isFinite(num)) continue;
    results.push({ file: path.join(root, entry.name), episodeNumber: num });
  }
  return results.sort((a, b) => a.episodeNumber - b.episodeNumber);
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), FirebaseModule],
})
class ScriptModule {}

async function main() {
  const root = process.argv[2];
  const seriesName = process.argv[3];
  if (!root || !seriesName) {
    console.error('Usage: npx ts-node -r dotenv/config src/scripts/sync-comic-episodes-to-firebase.ts "<folder path>" "<series name>"');
    process.exit(1);
  }
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    console.error(`Not a directory: ${root}`);
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(ScriptModule, { logger: ['error', 'warn'] });
  try {
    const firebase = app.get(FirebaseService);
    const collection = firebase.collection('comic_episodes');
    const bucket = firebase.getBucket();

    const episodes = findEpisodeFiles(root);
    console.log(`Found ${episodes.length} episode image(s) under ${root}.`);

    const existingSnap = await collection.where('seriesName', '==', seriesName).get();
    const existingNumbers = new Set(existingSnap.docs.map((d) => d.data().episodeNumber as number));

    let synced = 0;
    let skipped = 0;
    let failed = 0;

    for (const { file, episodeNumber } of episodes) {
      if (existingNumbers.has(episodeNumber)) {
        skipped += 1;
        continue;
      }

      process.stdout.write(`Uploading episode ${episodeNumber} (${path.basename(file)}) ... `);
      try {
        const buffer = fs.readFileSync(file);
        const ext = path.extname(file).slice(1).toLowerCase();
        // ASCII-only filename: Tumblr's server-side URL fetch (used by
        // TumblrService.publishPhoto's `source` param) returns a generic
        // "Error uploading photo" 400 for storage URLs containing non-ASCII
        // (e.g. Korean) path segments — confirmed by testing the same file
        // under an ASCII vs. non-ASCII path.
        const storageFilename = `comic-episodes/ep-${episodeNumber}-${Date.now()}.${ext}`;
        const storageFile = bucket.file(storageFilename);
        await storageFile.save(buffer, { metadata: { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}` } });
        await storageFile.makePublic();
        const imageUrl = `https://storage.googleapis.com/${bucket.name}/${storageFilename}`;

        await collection.add({
          episodeNumber,
          seriesName,
          title: `${episodeNumber}화`,
          imageUrl,
          createdAt: new Date().toISOString(),
          bloggerUrl: null,
          wordpressUrl: null,
          facebookUrl: null,
          tumblrUrl: null,
        });

        console.log('[OK]');
        synced += 1;
      } catch (err) {
        console.log(`[FAIL] ${err instanceof Error ? err.message : String(err)}`);
        failed += 1;
      }
    }

    console.log(`\nDone. Synced ${synced}, already synced ${skipped}, failed ${failed}.`);
  } finally {
    await app.close();
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
