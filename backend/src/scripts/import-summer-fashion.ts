/**
 * One-off import: pulls real, popular summer-fashion items from the live CJ
 * Dropshipping catalog and registers them into Firestore `cj_products` under
 * category "fashion", using the same document shape as CjShopService.registerProduct.
 * Run: npx ts-node -r dotenv/config src/scripts/import-summer-fashion.ts
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const projectId = process.env.FIREBASE_PROJECT_ID!;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL!;
const privateKey = process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n');
const CJ_API_KEY = process.env.CJ_DROPSHIPPING_API_KEY!;

if (!projectId || !clientEmail || !privateKey || !CJ_API_KEY) {
  console.error('Missing required env vars. Check backend/.env');
  process.exit(1);
}

if (getApps().length === 0) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const db = getFirestore();
const CJ_BASE = 'https://developers.cjdropshipping.com';
const AP_PER_USD = 10000;
const MARGIN_PERCENT = 150; // matches the existing "fashion" category convention
const TARGET_COUNT = Number(process.env.IMPORT_TARGET_COUNT) || 50;
const MAX_VARIANTS_PER_PRODUCT = 6;

// Keywords chosen for items that trend well as summer dropshipping fashion:
// beachwear, sun protection, warm-weather basics with broad appeal.
const KEYWORDS = [
  'one piece swimsuit',
  'cap women',
  'cardigan',
  'skort',
  'sarong',
];

function computeSupplyApPrice(cjPriceUsd: number): number {
  return Math.ceil(cjPriceUsd * AP_PER_USD);
}
function computeApPrice(cjPriceUsd: number, marginPercent: number): number {
  return Math.ceil(cjPriceUsd * AP_PER_USD * (1 + marginPercent / 100));
}

async function getAccessToken(): Promise<string> {
  const ref = db.collection('config').doc('cj_api_token');
  const snap = await ref.get();
  const cached = snap.data() as { accessToken?: string; accessTokenExpiryDate?: string } | undefined;
  const now = new Date();
  if (cached?.accessToken && cached.accessTokenExpiryDate && new Date(cached.accessTokenExpiryDate) > now) {
    return cached.accessToken;
  }
  const res = await fetch(`${CJ_BASE}/api2.0/v1/authentication/getAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: CJ_API_KEY }),
  });
  const body = await res.json();
  if (!body.result || !body.data) throw new Error(`CJ auth failed: ${body.message}`);
  await ref.set(body.data);
  return body.data.accessToken;
}

interface SearchItem {
  id: string;
  nameEn: string;
  sellPrice: string;
  listedNum: number;
  bigImage: string;
}

async function searchKeyword(token: string, keyword: string): Promise<SearchItem[]> {
  const url = new URL(`${CJ_BASE}/api2.0/v1/product/listV2`);
  url.searchParams.set('keyWord', keyword);
  url.searchParams.set('page', '1');
  url.searchParams.set('size', '20');
  const res = await fetch(url, { headers: { 'CJ-Access-Token': token } });
  const body = await res.json();
  if (!body.result || !body.data?.content?.length) return [];
  const items: SearchItem[] = body.data.content.flatMap((c: { productList: SearchItem[] }) => c.productList ?? []);
  return items
    .filter((i) => i.sellPrice && Number(i.sellPrice) > 0)
    .sort((a, b) => (b.listedNum ?? 0) - (a.listedNum ?? 0))
    .slice(0, 8);
}

interface DetailVariant {
  vid: string;
  variantNameEn: string;
  variantImage: string;
  variantSellPrice: number;
}
interface DetailResponse {
  productNameEn: string;
  productImageSet: string[];
  productVideo?: string;
  description?: string;
  variants: DetailVariant[];
}

async function fetchDetail(token: string, pid: string): Promise<DetailResponse | null> {
  const url = new URL(`${CJ_BASE}/api2.0/v1/product/query`);
  url.searchParams.set('pid', pid);
  const res = await fetch(url, { headers: { 'CJ-Access-Token': token } });
  const body = await res.json();
  if (!body.result || !body.data) return null;
  return body.data as DetailResponse;
}

async function main() {
  const token = await getAccessToken();

  const existingSnap = await db.collection('cj_products').select('cjProductId').get();
  const alreadyRegistered = new Set(existingSnap.docs.map((d) => d.data().cjProductId as string));
  console.log(`Existing products in catalog: ${alreadyRegistered.size}`);

  const seen = new Set<string>();
  const candidates: SearchItem[] = [];
  for (const kw of KEYWORDS) {
    const items = await searchKeyword(token, kw);
    for (const item of items) {
      if (seen.has(item.id) || alreadyRegistered.has(item.id)) continue;
      seen.add(item.id);
      candidates.push(item);
    }
    console.log(`[search] "${kw}" -> ${items.length} candidates (total unique: ${candidates.length})`);
    if (candidates.length >= TARGET_COUNT * 1.4) break;
  }

  let registered = 0;
  const results: { name: string; margin: number; apPrice: number }[] = [];

  for (const candidate of candidates) {
    if (registered >= TARGET_COUNT) break;
    try {
      const detail = await fetchDetail(token, candidate.id);
      if (!detail || !detail.variants?.length) continue;

      const variants = detail.variants.slice(0, MAX_VARIANTS_PER_PRODUCT).map((v) => ({
        vid: v.vid,
        label: v.variantNameEn,
        image: v.variantImage,
        cjPriceUsd: v.variantSellPrice,
        supplyApPrice: computeSupplyApPrice(v.variantSellPrice),
        apPrice: computeApPrice(v.variantSellPrice, MARGIN_PERCENT),
      }));
      const primary = variants[0];

      const product = {
        cjProductId: candidate.id,
        nameKo: detail.productNameEn.trim(),
        images: (detail.productImageSet ?? [candidate.bigImage]).slice(0, 8),
        video: detail.productVideo || null,
        description: detail.description || '',
        marginPercent: MARGIN_PERCENT,
        variants,
        cjVariantId: primary.vid,
        cjPriceUsd: primary.cjPriceUsd,
        supplyApPrice: primary.supplyApPrice,
        apPrice: primary.apPrice,
        category: 'fashion',
        active: true,
        createdAt: new Date().toISOString(),
      };

      await db.collection('cj_products').add(product);
      registered++;
      results.push({ name: product.nameKo, margin: MARGIN_PERCENT, apPrice: primary.apPrice });
      console.log(`[${registered}/${TARGET_COUNT}] registered: ${product.nameKo} (${primary.apPrice.toLocaleString()} AP)`);
    } catch (err) {
      console.warn(`Skipped ${candidate.id}: ${(err as Error).message}`);
    }
  }

  console.log(`\nDone. Registered ${registered} fashion products.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
