/**
 * One-off backfill: computes `hashtags` for every existing cj_products doc
 * that doesn't have one yet (algorithmic — tokenized name + category, see
 * cj-shop/hashtag.util.ts). New products get this automatically at
 * registration time via CjShopService.registerProduct.
 * Run: npx ts-node -r dotenv/config src/scripts/backfill-hashtags.ts
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { generateHashtags } from '../cj-shop/hashtag.util';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const projectId = process.env.FIREBASE_PROJECT_ID!;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL!;
const privateKey = process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n');

if (getApps().length === 0) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const db = getFirestore();
const BATCH_SIZE = 400;

async function main() {
  const snap = await db.collection('cj_products').get();
  console.log(`Total products: ${snap.size}`);

  const targets = snap.docs.filter((d) => {
    const data = d.data();
    return !Array.isArray(data.hashtags) || data.hashtags.length === 0;
  });
  console.log(`Missing hashtags: ${targets.length}`);

  let updated = 0;
  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const chunk = targets.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const doc of chunk) {
      const data = doc.data();
      const hashtags = generateHashtags(data.nameKo as string, data.category as string);
      batch.update(doc.ref, { hashtags });
    }
    await batch.commit();
    updated += chunk.length;
    console.log(`Updated ${updated}/${targets.length}`);
  }

  console.log('Done.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
