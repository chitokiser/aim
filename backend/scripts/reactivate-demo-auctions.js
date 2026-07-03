/**
 * Reactivates the 101 cancelled `sellerId: 'seed-system'` demo auctions by
 * pushing their `endsAt` back into the future and resetting bid state.
 * They were auto-cancelled by the EVERY_MINUTE cron once their original
 * demo end times passed with no real bids.
 *
 * Usage (from backend/ directory):
 *   node scripts/reactivate-demo-auctions.js
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

const HOUR = 3_600_000;
const DAY = 86_400_000;
// Spread new end times randomly between 6 hours and 14 days from now,
// so they don't all expire again at the same instant.
const MIN_MS = 6 * HOUR;
const MAX_MS = 14 * DAY;

async function run() {
  const snap = await db
    .collection('auctions')
    .where('sellerId', '==', 'seed-system')
    .where('status', '==', 'cancelled')
    .get();

  console.log(`Found ${snap.size} cancelled demo auction(s) to reactivate.`);

  let updated = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const newEndsAt = new Date(Date.now() + MIN_MS + Math.random() * (MAX_MS - MIN_MS)).toISOString();
    await doc.ref.update({
      status: 'active',
      endsAt: newEndsAt,
      currentBid: data.startPrice,
      currentBidderId: '',
      currentBidderName: '',
      bidCount: 0,
      extensionCount: 0,
    });
    updated++;
  }

  console.log(`Reactivated ${updated} demo auction(s).`);
  process.exit(0);
}

run().catch((err) => {
  console.error('Reactivation failed:', err);
  process.exit(1);
});
