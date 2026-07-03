/**
 * Lists every cj_products doc whose `category` is "other" (or missing).
 * Read-only — makes no Firestore writes.
 *
 * Usage (from backend/ directory):
 *   node scripts/list-other-category-products.js
 */

const path = require('path');
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

async function run() {
  const snap = await db.collection('cj_products').get();
  const others = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => !p.category || p.category === 'other');

  console.log(`Found ${others.length} product(s) with category "other":\n`);
  for (const p of others) {
    console.log(`id=${p.id}`);
    console.log(`  nameKo: ${p.nameKo}`);
    console.log(`  cjProductId: ${p.cjProductId}`);
    console.log(`  category: ${p.category}`);
    console.log('');
  }
  process.exit(0);
}

run().catch((err) => {
  console.error('List failed:', err);
  process.exit(1);
});
