/**
 * One-off backfill: assigns `productNo` to the earliest coupang_products docs
 * created before the numbering field existed. Ordered by createdAt ascending,
 * starting from 1, filling only docs that have no productNo.
 * Run: npx ts-node -r dotenv/config src/scripts/backfill-coupang-product-no.ts
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const projectId = process.env.FIREBASE_PROJECT_ID!;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL!;
const privateKey = process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n');

if (getApps().length === 0) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const db = getFirestore();

async function main() {
  const snap = await db.collection('coupang_products').get();
  console.log(`Total products: ${snap.size}`);

  const withNo = snap.docs
    .map((d) => d.data()['productNo'])
    .filter((n): n is number => typeof n === 'number');
  const maxNo = withNo.length ? Math.max(...withNo) : 0;
  console.log(`Existing productNo range: ${withNo.length ? Math.min(...withNo) : '-'} to ${maxNo}`);

  const missing = snap.docs
    .filter((d) => typeof d.data()['productNo'] !== 'number')
    .sort((a, b) => (a.data()['createdAt'] as string).localeCompare(b.data()['createdAt'] as string));

  console.log(`Missing productNo: ${missing.length}`);
  if (missing.length === 0) return;

  const startNo = 1;
  const batch = db.batch();
  missing.forEach((d, i) => {
    const productNo = startNo + i;
    console.log(`  ${d.id} (${d.data()['name']}, created ${d.data()['createdAt']}) -> productNo ${productNo}`);
    batch.update(d.ref, { productNo });
  });
  await batch.commit();
  console.log(`Backfilled ${missing.length} docs.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
