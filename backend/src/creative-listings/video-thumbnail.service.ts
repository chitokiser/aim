import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { FirebaseService } from '../firebase/firebase.service';

const execFileAsync = promisify(execFile);
const TIMEOUT_MS = 15_000;

// Generates a thumbnail by grabbing a frame directly from a remote video URL
// via ffmpeg (installed via nixpacks.toml's aptPkgs). This runs server-side
// specifically because the equivalent browser-side approach (an offscreen
// <video> + canvas capture, see creative-market/page.tsx) silently fails for
// most real listing sources — Facebook/Instagram/TikTok CDNs don't set
// Access-Control-Allow-Origin, so the canvas is "tainted" and unusable.
// ffmpeg fetching the same URL server-to-server has no such restriction.
@Injectable()
export class VideoThumbnailService {
  private readonly logger = new Logger(VideoThumbnailService.name);

  constructor(private readonly firebase: FirebaseService) {}

  async generate(videoUrl: string): Promise<string | null> {
    const outPath = path.join(os.tmpdir(), `cm-thumb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`);
    try {
      try {
        await execFileAsync('ffmpeg', [
          '-y', '-ss', '00:00:01', '-i', videoUrl,
          '-frames:v', '1', '-vf', 'scale=480:-1',
          outPath,
        ], { timeout: TIMEOUT_MS });
      } catch {
        // Clip may be shorter than 1s — retry from the very start.
        await execFileAsync('ffmpeg', [
          '-y', '-i', videoUrl,
          '-frames:v', '1', '-vf', 'scale=480:-1',
          outPath,
        ], { timeout: TIMEOUT_MS });
      }

      if (!fs.existsSync(outPath)) return null;
      const buffer = fs.readFileSync(outPath);

      const bucket = this.firebase.getBucket();
      const filename = `creative-market-thumbs/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const file = bucket.file(filename);
      await file.save(buffer, { metadata: { contentType: 'image/jpeg' } });
      await file.makePublic();
      return `https://storage.googleapis.com/${bucket.name}/${filename}`;
    } catch (err) {
      this.logger.warn(`Video thumbnail generation failed for "${videoUrl}": ${err instanceof Error ? err.message : String(err)}`);
      return null;
    } finally {
      if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
    }
  }
}
