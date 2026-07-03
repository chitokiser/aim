/**
 * Exports {id, name} for every cj_products doc whose `nameKo` field contains
 * no Hangul (i.e. still the raw English CJ title) to a local JSON file.
 * Read-only — makes no Firestore writes.
 *
 * Usage (from backend/ directory):
 *   node scripts/export-untranslated-names.js
 *
 * Output: backend/scripts/untranslated-names.json
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error('Missing Firebase credentials in .env');
  process.exit(1);
}

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

const HANGUL_RE = /[가-힣]/;

async function run() {
  const snap = await db.collection('cj_products').get();
  const targets = snap.docs
    .map((d) => ({ id: d.id, name: d.data().nameKo || '' }))
    .filter((p) => p.name && !HANGUL_RE.test(p.name));

  const outPath = path.resolve(__dirname, 'untranslated-names.json');
  fs.writeFileSync(outPath, JSON.stringify(targets, null, 2));
  console.log(`Exported ${targets.length} untranslated product name(s) to ${outPath}`);
  process.exit(0);
}

run().catch((err) => {
  console.error('Export failed:', err);
  process.exit(1);
});
