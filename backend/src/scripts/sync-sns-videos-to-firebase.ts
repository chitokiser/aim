/**
 * Local-only sync: recursively scans a local video folder, uploads every
 * not-yet-synced video to Firebase Storage, and creates a Firestore doc
 * (collection `sns_videos`) so SnsVideoSchedulerService can cross-post it to
 * Blogger/Tumblr (and later Facebook/WordPress) at a slow 2h/video cadence.
 *
 * This MUST run locally — Railway has no access to the user's local
 * filesystem — but only needs to run once per new batch of videos dropped
 * into the folder; safe to re-run (already-synced files are skipped via
 * their relativePath already existing in Firestore).
 *
 * Run: npx ts-node -r dotenv/config src/scripts/sync-sns-videos-to-firebase.ts "<folder path>"
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

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv']);
// Anything this large is impractical for social posting anyway (well past
// Tumblr's 100MB cap, and a poor fit for a short-form post) — skip outright
// rather than spend minutes uploading a multi-hundred-MB file that will
// never actually get posted anywhere.
const MAX_SIZE_BYTES = 500 * 1024 * 1024;

function findVideoFiles(root: string): string[] {
  const results: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        results.push(full);
      }
    }
  };
  walk(root);
  return results.sort();
}

function titleFromFilename(filePath: string): string {
  return path.basename(filePath, path.extname(filePath)).replace(/[_-]+/g, ' ').trim();
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), FirebaseModule],
})
class ScriptModule {}

async function main() {
  const root = process.argv[2];
  if (!root) {
    console.error('Usage: npx ts-node -r dotenv/config src/scripts/sync-sns-videos-to-firebase.ts "<folder path>"');
    process.exit(1);
  }
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    console.error(`Not a directory: ${root}`);
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(ScriptModule, { logger: ['error', 'warn'] });
  try {
    const firebase = app.get(FirebaseService);
    const collection = firebase.collection('sns_videos');
    const bucket = firebase.getBucket();

    const files = findVideoFiles(root);
    console.log(`Found ${files.length} video file(s) under ${root}.`);

    const existingSnap = await collection.get();
    const existingPaths = new Set(existingSnap.docs.map((d) => d.data().relativePath as string));

    let synced = 0;
    let skipped = 0;
    let tooLarge = 0;
    let failed = 0;

    for (const file of files) {
      const relativePath = path.relative(root, file);
      if (existingPaths.has(relativePath)) {
        skipped += 1;
        continue;
      }

      const stat = fs.statSync(file);
      if (stat.size > MAX_SIZE_BYTES) {
        console.log(`Skipping: ${relativePath} (${(stat.size / 1024 / 1024).toFixed(0)}MB > 500MB cap)`);
        tooLarge += 1;
        continue;
      }

      process.stdout.write(`Uploading: ${relativePath} (${(stat.size / 1024 / 1024).toFixed(1)}MB) ... `);

      try {
        const buffer = fs.readFileSync(file);
        const ext = path.extname(file).slice(1).toLowerCase();
        const storageFilename = `sns-videos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const storageFile = bucket.file(storageFilename);
        await storageFile.save(buffer, { metadata: { contentType: `video/${ext === 'mov' ? 'quicktime' : ext}` } });
        await storageFile.makePublic();
        const videoUrl = `https://storage.googleapis.com/${bucket.name}/${storageFilename}`;

        await collection.add({
          relativePath,
          title: titleFromFilename(file),
          videoUrl,
          sizeBytes: stat.size,
          createdAt: new Date().toISOString(),
          bloggerUrl: null,
          tumblrUrl: null,
          tumblrSkipReason: null,
          facebookUrl: null,
          wordpressUrl: null,
        });

        console.log('[OK]');
        synced += 1;
      } catch (err) {
        console.log(`[FAIL] ${err instanceof Error ? err.message : String(err)}`);
        failed += 1;
      }
    }

    console.log(`\nDone. Synced ${synced}, already synced ${skipped}, too large ${tooLarge}, failed ${failed}.`);
  } finally {
    await app.close();
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
