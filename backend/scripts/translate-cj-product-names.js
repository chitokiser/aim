/**
 * Translates raw CJ Dropshipping English product names (the `nameKo` field
 * on Firestore `cj_products` docs) into natural, concise Korean names using
 * Claude, and updates each doc in place. Only touches docs whose current
 * `nameKo` contains no Hangul (i.e. still the raw English CJ title) — already
 * Korean-named products are left untouched.
 *
 * Defaults to a DRY RUN (prints proposed translations, writes nothing).
 * Pass --confirm to actually write to Firestore.
 *
 * Usage (from backend/ directory):
 *   node scripts/translate-cj-product-names.js
 *   node scripts/translate-cj-product-names.js --confirm
 *   node scripts/translate-cj-product-names.js --limit=50 --confirm   # translate only the first 50 (testing)
 *
 * Reads FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY,
 * ANTHROPIC_API_KEY from backend/.env
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const Anthropic = require('@anthropic-ai/sdk').default;

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const anthropicKey = process.env.ANTHROPIC_API_KEY;

if (!projectId || !clientEmail || !privateKey) {
  console.error('Missing Firebase credentials in .env');
  process.exit(1);
}
if (!anthropicKey || anthropicKey === 'your-anthropic-api-key') {
  console.error('Missing ANTHROPIC_API_KEY in .env');
  process.exit(1);
}

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();
const anthropic = new Anthropic({ apiKey: anthropicKey });
const MODEL = 'claude-opus-4-8';

const BATCH_SIZE = 25; // product names per Claude request
const FIRESTORE_COMMIT_CHUNK = 400; // stay under Firestore's 500-write batch limit
const REQUEST_DELAY_MS = 300;

const HANGUL_RE = /[가-힣]/;

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, v] = a.replace(/^--/, '').split('=');
      return [k, v ?? true];
    }),
  );
  return {
    confirm: args.confirm === true || args.confirm === 'true',
    limit: args.limit ? parseInt(args.limit, 10) : Infinity,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractJSON(text) {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (match ? match[1] : text).trim();
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function translateBatch(names) {
  const prompt =
    `You are naming products for a Korean e-commerce shop. Below is a JSON array of raw ` +
    `CJ Dropshipping / AliExpress-style English product titles — they are often repetitive ` +
    `or awkwardly worded (e.g. "Jewelry Summer Body Jewelry New Jewelry").\n\n` +
    `Rewrite each one as a natural, concise Korean product name suitable for a shop listing ` +
    `card (roughly 8-20 Korean characters, no trailing punctuation). Keep it accurate to what ` +
    `the product actually is, remove redundant repeated words, and use common Korean ` +
    `e-commerce phrasing.\n\n` +
    `Input:\n${JSON.stringify(names)}\n\n` +
    `Return ONLY a JSON array of ${names.length} Korean strings, same order, no explanation, no markdown.`;

  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = resp.content[0].type === 'text' ? resp.content[0].text : '[]';
  const result = JSON.parse(extractJSON(text));
  if (!Array.isArray(result) || result.length !== names.length) {
    throw new Error(`Translation batch size mismatch: expected ${names.length}, got ${Array.isArray(result) ? result.length : typeof result}`);
  }
  return result;
}

async function run() {
  const { confirm, limit } = parseArgs();
  const dryRun = !confirm;

  console.log(dryRun ? '=== DRY RUN (no writes — pass --confirm to actually update) ===' : '=== LIVE RUN — writing to Firestore ===');

  const snap = await db.collection('cj_products').get();
  const targets = snap.docs
    .map((d) => ({ id: d.id, ref: d.ref, nameKo: d.data().nameKo || '' }))
    .filter((p) => p.nameKo && !HANGUL_RE.test(p.nameKo))
    .slice(0, limit);

  console.log(`Found ${targets.length} product(s) with untranslated (non-Korean) names.\n`);
  if (targets.length === 0) {
    process.exit(0);
  }

  const batches = chunk(targets, BATCH_SIZE);
  let translated = 0;
  let errors = 0;
  let pendingWrites = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`Batch ${i + 1}/${batches.length} (${batch.length} items)...`);
    let koreanNames;
    try {
      koreanNames = await translateBatch(batch.map((p) => p.nameKo));
    } catch (err) {
      console.error(`  batch failed: ${err.message}`);
      errors += batch.length;
      await sleep(REQUEST_DELAY_MS);
      continue;
    }

    batch.forEach((p, idx) => {
      const newName = koreanNames[idx];
      console.log(`  ${p.nameKo}  ->  ${newName}`);
      pendingWrites.push({ ref: p.ref, newName });
      translated++;
    });

    await sleep(REQUEST_DELAY_MS);
  }

  if (!dryRun && pendingWrites.length > 0) {
    console.log('\nWriting updates to Firestore...');
    for (const group of chunk(pendingWrites, FIRESTORE_COMMIT_CHUNK)) {
      const writeBatch = db.batch();
      group.forEach(({ ref, newName }) => writeBatch.update(ref, { nameKo: newName }));
      await writeBatch.commit();
      console.log(`  committed ${group.length} update(s)`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`${translated} ${dryRun ? 'would be translated' : 'translated'}, ${errors} errors`);
  if (dryRun) {
    console.log('\nThis was a dry run — nothing was written. Re-run with --confirm to actually update names.');
  }
  process.exit(0);
}

run().catch((err) => {
  console.error('Translation failed:', err);
  process.exit(1);
});
