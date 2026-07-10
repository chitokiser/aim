/**
 * Recursively uploads every video file under a local folder to Tumblr as a
 * video post, one at a time with a delay between uploads. Safe to re-run —
 * already-uploaded files are tracked in a state file written inside the
 * target folder itself (never touches git).
 *
 * Run: npx ts-node -r dotenv/config src/scripts/upload-videos-to-tumblr.ts "<folder path>"
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import OAuth from 'oauth-1.0a';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv']);
const MAX_SIZE_BYTES = 100 * 1024 * 1024; // Tumblr's documented API upload limit
const DELAY_MS = 25_000;
const STATE_FILENAME = '.tumblr-uploaded.json';

const CONSUMER_KEY = process.env.TUMBLR_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.TUMBLR_CONSUMER_SECRET;
const ACCESS_TOKEN = process.env.TUMBLR_ACCESS_TOKEN;
const ACCESS_TOKEN_SECRET = process.env.TUMBLR_ACCESS_TOKEN_SECRET;
const BLOG_NAME = process.env.TUMBLR_BLOG_NAME;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function loadState(root: string): Set<string> {
  const statePath = path.join(root, STATE_FILENAME);
  if (!fs.existsSync(statePath)) return new Set();
  try {
    const data = JSON.parse(fs.readFileSync(statePath, 'utf8')) as string[];
    return new Set(data);
  } catch {
    return new Set();
  }
}

function saveState(root: string, uploaded: Set<string>) {
  const statePath = path.join(root, STATE_FILENAME);
  fs.writeFileSync(statePath, JSON.stringify([...uploaded], null, 2), 'utf8');
}

function titleFromFilename(filePath: string): string {
  return path.basename(filePath, path.extname(filePath)).replace(/[_-]+/g, ' ').trim();
}

async function uploadVideo(filePath: string): Promise<{ ok: boolean; reason?: string; url?: string }> {
  const stat = fs.statSync(filePath);
  if (stat.size > MAX_SIZE_BYTES) {
    return { ok: false, reason: `too large (${(stat.size / 1024 / 1024).toFixed(0)}MB > 100MB limit)` };
  }

  const oauth = new OAuth({
    consumer: { key: CONSUMER_KEY!, secret: CONSUMER_SECRET! },
    signature_method: 'HMAC-SHA1',
    hash_function(baseString, key) {
      return crypto.createHmac('sha1', key).update(baseString).digest('base64');
    },
  });
  const token = { key: ACCESS_TOKEN!, secret: ACCESS_TOKEN_SECRET! };
  const url = `https://api.tumblr.com/v2/blog/${encodeURIComponent(BLOG_NAME!)}/post`;
  const caption = titleFromFilename(filePath);

  // OAuth 1.0a signs only the non-binary fields for multipart requests — the
  // file itself is never part of the signature base string.
  const signedParams = { type: 'video', caption, state: 'published' };
  const authHeader = oauth.toHeader(oauth.authorize({ url, method: 'POST', data: signedParams }, token));

  const form = new FormData();
  form.append('type', 'video');
  form.append('caption', caption);
  form.append('state', 'published');
  const buffer = fs.readFileSync(filePath);
  form.append('data', new Blob([buffer]), path.basename(filePath));

  try {
    const res = await fetch(url, { method: 'POST', headers: { ...authHeader }, body: form });
    // Tumblr post IDs exceed JS's safe-integer range — use `id_string`, not
    // the numeric `id` field, or the resulting URL silently points nowhere.
    const json = (await res.json().catch(() => null)) as
      | { response?: { id?: number; id_string?: string }; meta?: { status?: number; msg?: string } }
      | null;

    if (!res.ok || !json?.response?.id_string) {
      return { ok: false, reason: `HTTP ${res.status}: ${JSON.stringify(json)}` };
    }
    return { ok: true, url: `https://${BLOG_NAME}/post/${json.response.id_string}` };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  const root = process.argv[2];
  if (!root) {
    console.error('Usage: npx ts-node -r dotenv/config src/scripts/upload-videos-to-tumblr.ts "<folder path>"');
    process.exit(1);
  }
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    console.error(`Not a directory: ${root}`);
    process.exit(1);
  }
  if (!CONSUMER_KEY || !CONSUMER_SECRET || !ACCESS_TOKEN || !ACCESS_TOKEN_SECRET || !BLOG_NAME) {
    console.error('Tumblr is not configured (missing TUMBLR_* vars in backend/.env).');
    process.exit(1);
  }

  const files = findVideoFiles(root);
  const uploaded = loadState(root);
  const pending = files.filter((f) => !uploaded.has(f));

  console.log(`Found ${files.length} video file(s), ${pending.length} not yet uploaded.\n`);

  let posted = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of pending) {
    const rel = path.relative(root, file);
    process.stdout.write(`Uploading: ${rel} ... `);
    const result = await uploadVideo(file);
    if (result.ok) {
      console.log(`[OK] ${result.url}`);
      uploaded.add(file);
      saveState(root, uploaded);
      posted += 1;
    } else if (result.reason?.startsWith('too large')) {
      console.log(`[SKIP] ${result.reason}`);
      skipped += 1;
    } else {
      console.log(`[FAIL] ${result.reason}`);
      failed += 1;
    }
    await sleep(DELAY_MS);
  }

  console.log(`\nDone. Posted ${posted}, skipped (too large) ${skipped}, failed ${failed}.`);
  if (skipped > 0) {
    console.log('Skipped files were left out of the state file, so re-running after compressing them will retry.');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
