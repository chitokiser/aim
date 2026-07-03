/**
 * Reassigns the `category` field for cj_products docs currently set to "other",
 * based on product name + CJ's own top-level category naming. Leaves exactly
 * one genuinely miscellaneous product as "other".
 *
 * Usage (from backend/ directory):
 *   node scripts/recategorize-other-products.js
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

// id -> new category (must be one of CJ_CATEGORY_VALUES in frontend/src/app/admin/page.tsx)
const REASSIGN = {
  '6TSntRj7YhCTdrglfm5y': 'household',    // Sponge Household One Clean Absorbent Mop
  '8ICgROjgsX9KjYpjL2Pl': 'pet',          // Ultrasonic Anti-Barking Device
  'JBM0asgQYw0nPoRE0Lqj': 'watches',      // Y90 Smart Watch GPS
  'P7RvmmpX2s7R96YJCuwV': 'homeDecor',    // Crystal ball ornaments
  'PCK4Uk3QhskIcZ35RNGz': 'kitchen',      // Electric Grape Peeler
  'eSrvxPjtGM8faIzHKTfs': 'kitchen',      // Electric Fruit Peeler
  'fT09qqkwYETdeV1GmdAE': 'watches',      // Smart Watch Card Call
  'fq6nxyytCjJ7wSqO0BMs': 'homeDecor',    // Large Glass/Crystal Ball
  'ixKp6CoUhq606GsFAffN': 'household',    // Flat Squeeze Mop
  'nkhJpSn3ZkOLloaqzoUb': 'carAccessories', // Suction cup car phone holder
  'rOHk3mtKNuov7KJfQZ0z': 'beauty',       // Hair Straightener Brush
  'sBb5fyRClOmkPWzX2Gkf': 'household',    // Upgraded Mini Mops
  't3xaodl4ItqrBDkSEu99': 'homeDecor',    // Obsidian Crystal Ball
  // uyrHqiUYWZ8anGPhucPc (Mini fan) intentionally left as "other" — the one
  // genuinely uncategorized product per the requested "keep one" rule.
};

async function run() {
  let updated = 0;
  for (const [id, category] of Object.entries(REASSIGN)) {
    const ref = db.collection('cj_products').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      console.warn(`skip ${id}: not found`);
      continue;
    }
    await ref.update({ category });
    console.log(`${id} -> ${category} (${snap.data().nameKo})`);
    updated++;
  }
  console.log(`\nUpdated ${updated} product(s).`);
  process.exit(0);
}

run().catch((err) => {
  console.error('Update failed:', err);
  process.exit(1);
});
