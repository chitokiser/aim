/**
 * Local-only sync: recursively scans a local video folder, uploads every
 * not-yet-synced video to Firebase Storage (plus a thumbnail frame extracted
 * via ffmpeg), and creates a Firestore doc (collection `sns_videos`) so
 * SnsVideoSchedulerService can cross-post it to Blogger/Tumblr (and later
 * Facebook/WordPress) at a slow 2h/video cadence.
 *
 * This MUST run locally — Railway has no access to the user's local
 * filesystem, and ffmpeg isn't part of the deployed backend — but only needs
 * to run once per new batch of videos dropped into the folder; safe to
 * re-run (already-synced files are skipped via their relativePath already
 * existing in Firestore). Also backfills thumbnailUrl for any doc that was
 * synced before thumbnails were added, as long as its source file still
 * exists at the same relativePath under `root`.
 *
 * Requires ffmpeg on PATH (used to grab a single frame as the thumbnail).
 *
 * Run: npx ts-node -r dotenv/config src/scripts/sync-sns-videos-to-firebase.ts "<folder path>"
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
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

// Grabs the frame at 1s in (falls back to the very first frame for clips
// shorter than that) and scales it down — this is just a list/preview
// thumbnail, not the video itself.
function extractThumbnail(videoPath: string): Buffer | null {
  const outPath = path.join(os.tmpdir(), `sns-thumb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`);
  try {
    execFileSync('ffmpeg', [
      '-y', '-ss', '00:00:01', '-i', videoPath,
      '-frames:v', '1', '-vf', 'scale=480:-1',
      outPath,
    ], { stdio: 'pipe' });
    if (!fs.existsSync(outPath)) return null;
    const buffer = fs.readFileSync(outPath);
    return buffer;
  } catch {
    // Clip may be shorter than 1s — retry from the very start.
    try {
      execFileSync('ffmpeg', [
        '-y', '-i', videoPath,
        '-frames:v', '1', '-vf', 'scale=480:-1',
        outPath,
      ], { stdio: 'pipe' });
      if (!fs.existsSync(outPath)) return null;
      return fs.readFileSync(outPath);
    } catch {
      return null;
    }
  } finally {
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  }
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

    async function uploadThumbnail(videoPath: string): Promise<string | null> {
      const thumbBuffer = extractThumbnail(videoPath);
      if (!thumbBuffer) return null;
      const thumbFilename = `sns-videos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-thumb.jpg`;
      const thumbFile = bucket.file(thumbFilename);
      await thumbFile.save(thumbBuffer, { metadata: { contentType: 'image/jpeg' } });
      await thumbFile.makePublic();
      return `https://storage.googleapis.com/${bucket.name}/${thumbFilename}`;
    }

    const files = findVideoFiles(root);
    console.log(`Found ${files.length} video file(s) under ${root}.`);

    const existingSnap = await collection.get();
    const existingByPath = new Map(existingSnap.docs.map((d) => [d.data().relativePath as string, d]));

    let synced = 0;
    let skipped = 0;
    let tooLarge = 0;
    let failed = 0;
    let thumbsBackfilled = 0;

    for (const file of files) {
      const relativePath = path.relative(root, file);
      const existingDoc = existingByPath.get(relativePath);

      if (existingDoc) {
        skipped += 1;
        if (!existingDoc.data().thumbnailUrl) {
          process.stdout.write(`Backfilling thumbnail: ${relativePath} ... `);
          const thumbnailUrl = await uploadThumbnail(file);
          if (thumbnailUrl) {
            await existingDoc.ref.update({ thumbnailUrl });
            console.log('[OK]');
            thumbsBackfilled += 1;
          } else {
            console.log('[FAIL — could not extract frame]');
          }
        }
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

        const thumbnailUrl = await uploadThumbnail(file);

        await collection.add({
          relativePath,
          title: titleFromFilename(file),
          videoUrl,
          thumbnailUrl,
          sizeBytes: stat.size,
          createdAt: new Date().toISOString(),
          bloggerUrl: null,
          tumblrUrl: null,
          tumblrSkipReason: null,
          facebookUrl: null,
          wordpressUrl: null,
        });

        console.log(thumbnailUrl ? '[OK]' : '[OK, no thumbnail]');
        synced += 1;
      } catch (err) {
        console.log(`[FAIL] ${err instanceof Error ? err.message : String(err)}`);
        failed += 1;
      }
    }

    console.log(`\nDone. Synced ${synced}, already synced ${skipped} (${thumbsBackfilled} thumbnails backfilled), too large ${tooLarge}, failed ${failed}.`);
  } finally {
    await app.close();
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
