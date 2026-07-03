/**
 * Bulk-registers CJ Dropshipping products into Firestore `cj_products`,
 * mirroring the exact write shape used by CjShopService.registerProduct()
 * in ../src/cj-shop/cj-shop.service.ts (keep the two in sync if that
 * pricing/schema logic ever changes).
 *
 * Defaults to a DRY RUN (prints what it would register, writes nothing).
 * Pass --confirm to actually write to Firestore.
 *
 * Usage (from backend/ directory):
 *   node scripts/bulk-register-cj-products.js --categories=jewelry,optical --count=15
 *   node scripts/bulk-register-cj-products.js --categories=jewelry,optical --count=15 --confirm
 *
 * Flags:
 *   --categories=a,b,c   Category keys from CJ_CATEGORY_VALUES (see frontend/src/app/admin/page.tsx).
 *                        Defaults to a small pilot set: jewelry,optical
 *   --count=N            New products to register per category (default 15)
 *   --confirm            Actually write to Firestore. Without this flag, nothing is written.
 *
 * Reads FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY,
 * CJ_DROPSHIPPING_API_KEY from backend/.env
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const cjApiKey = process.env.CJ_DROPSHIPPING_API_KEY;

if (!projectId || !clientEmail || !privateKey) {
  console.error('Missing Firebase credentials in .env');
  process.exit(1);
}
if (!cjApiKey) {
  console.error('Missing CJ_DROPSHIPPING_API_KEY in .env');
  process.exit(1);
}

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

const CJ_BASE = 'https://developers.cjdropshipping.com';
const AP_PER_USD = 10000;
const REQUEST_DELAY_MS = 500; // gentle pacing — CJ API has no documented backoff handling in this app

// Category -> { CJ search keyword, margin % } — margin tiers follow the
// AI119 rule: real AP/cash portion must stay well above CJ cost even when a
// member pays up to 90% of the price with EXP (see project memory
// "EXP payment cap tied to margin"). High-margin visual categories get a
// high ceiling; low-margin staples get a conservative one.
const CATEGORY_CONFIG = {
  jewelry: { keyword: 'jewelry', marginPercent: 1000 },
  watches: { keyword: 'watch', marginPercent: 500 },
  art: { keyword: 'wall art decor', marginPercent: 400 },
  bagsShoes: { keyword: 'handbag', marginPercent: 400 },
  carAccessories: { keyword: 'car accessories', marginPercent: 300 },
  lighting: { keyword: 'led light', marginPercent: 300 },
  optical: { keyword: 'sunglasses', marginPercent: 300 },
  beauty: { keyword: 'beauty tool', marginPercent: 150 },
  fashion: { keyword: 'fashion accessories', marginPercent: 150 },
  sportsOutdoor: { keyword: 'outdoor sports gear', marginPercent: 150 },
  toysHobby: { keyword: 'hobby toy', marginPercent: 150 },
  homeDecor: { keyword: 'home decor', marginPercent: 150 },
  smartphone: { keyword: 'phone accessories', marginPercent: 100 },
  electronics: { keyword: 'electronics gadget', marginPercent: 80 },
  kitchen: { keyword: 'kitchen gadget', marginPercent: 80 },
  household: { keyword: 'home organizer', marginPercent: 60 },
  kids: { keyword: 'kids toy', marginPercent: 60 },
  pet: { keyword: 'pet supplies', marginPercent: 60 },
};

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, v] = a.replace(/^--/, '').split('=');
      return [k, v ?? true];
    }),
  );
  const categories = (args.categories ? String(args.categories).split(',') : ['jewelry', 'optical'])
    .map((c) => c.trim())
    .filter(Boolean);
  const count = Math.max(1, parseInt(args.count, 10) || 15);
  const confirm = args.confirm === true || args.confirm === 'true';
  return { categories, count, confirm };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeSupplyApPrice(cjPriceUsd) {
  return Math.ceil(cjPriceUsd * AP_PER_USD);
}

function computeApPrice(cjPriceUsd, marginPercent) {
  return Math.ceil(cjPriceUsd * AP_PER_USD * (1 + marginPercent / 100));
}

// ── CJ API client (mirrors CjShopService's auth flow, sharing the same
//    config/cj_api_token cache doc used by the live backend) ────────────────

async function getValidAccessToken() {
  const ref = db.collection('config').doc('cj_api_token');
  const snap = await ref.get();
  const cached = snap.data();
  const now = new Date();

  if (cached?.accessToken && cached.accessTokenExpiryDate && new Date(cached.accessTokenExpiryDate) > now) {
    return cached.accessToken;
  }

  if (cached?.refreshToken && cached.refreshTokenExpiryDate && new Date(cached.refreshTokenExpiryDate) > now) {
    try {
      const res = await fetch(`${CJ_BASE}/api2.0/v1/authentication/refreshAccessToken`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: cached.refreshToken }),
      });
      const body = await res.json();
      if (body.result && body.data) {
        await ref.set(body.data);
        return body.data.accessToken;
      }
    } catch {
      // fall through to full re-auth
    }
  }

  const res = await fetch(`${CJ_BASE}/api2.0/v1/authentication/getAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: cjApiKey }),
  });
  const body = await res.json();
  if (!body.result || !body.data) {
    throw new Error(`CJ auth failed: ${body.message ?? 'unknown error'}`);
  }
  await ref.set(body.data);
  return body.data.accessToken;
}

async function cjRequest(method, urlPath, { query, body } = {}) {
  const url = new URL(`${CJ_BASE}${urlPath}`);
  if (query) Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
  const accessToken = await getValidAccessToken();
  const res = await fetch(url.toString(), {
    method,
    headers: { 'Content-Type': 'application/json', 'CJ-Access-Token': accessToken },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok || json.result === false) {
    throw new Error(`CJ API error: ${json.message ?? res.statusText}`);
  }
  return json.data;
}

async function searchCjCatalog(keyword, page = 1) {
  const data = await cjRequest('GET', '/api2.0/v1/product/listV2', {
    query: { keyWord: keyword, page: String(page), size: '20' },
  });
  return (data?.content?.[0]?.productList ?? []);
}

async function getCjProductDetail(pid) {
  return cjRequest('GET', '/api2.0/v1/product/query', { query: { pid } });
}

// ── Main ─────────────────────────────────────────────────────────────────

async function loadRegisteredCjProductIds() {
  const snap = await db.collection('cj_products').get();
  return new Set(snap.docs.map((d) => d.data().cjProductId).filter(Boolean));
}

async function registerOneProduct({ item, detail, category, marginPercent, dryRun }) {
  const variants = (detail.variants || [])
    .map((v) => {
      const cjPriceUsd = parseFloat(v.variantSellPrice || item.sellPrice || '0') || 0;
      return {
        vid: v.vid,
        label: v.variantNameEn || v.vid,
        image: v.variantImage || undefined,
        cjPriceUsd,
        supplyApPrice: computeSupplyApPrice(cjPriceUsd),
        apPrice: computeApPrice(cjPriceUsd, marginPercent),
      };
    })
    .filter((v) => v.cjPriceUsd > 0);

  if (variants.length === 0) return { skipped: 'no-priced-variants' };

  const primary = variants[0];
  const gallery = Array.from(
    new Set([...variants.map((v) => v.image), item.bigImage, ...(detail.productImageSet || [])].filter(Boolean)),
  );

  const product = {
    cjProductId: item.id,
    nameKo: item.nameEn, // raw CJ English name — not yet translated, see script header note
    images: gallery,
    video: detail.productVideo || null,
    description: detail.description || '',
    marginPercent,
    variants,
    cjVariantId: primary.vid,
    cjPriceUsd: primary.cjPriceUsd,
    supplyApPrice: primary.supplyApPrice,
    apPrice: primary.apPrice,
    category,
    active: true,
    createdAt: new Date().toISOString(),
  };

  if (!dryRun) {
    await db.collection('cj_products').add(product);
  }
  return { registered: product };
}

async function run() {
  const { categories, count, confirm } = parseArgs();
  const dryRun = !confirm;

  const unknown = categories.filter((c) => !CATEGORY_CONFIG[c]);
  if (unknown.length > 0) {
    console.error(`Unknown/unsupported category key(s): ${unknown.join(', ')}`);
    console.error(`Supported: ${Object.keys(CATEGORY_CONFIG).join(', ')}`);
    process.exit(1);
  }

  console.log(dryRun ? '=== DRY RUN (no writes — pass --confirm to actually register) ===' : '=== LIVE RUN — writing to Firestore ===');
  console.log(`Categories: ${categories.join(', ')} | count/category: ${count}\n`);

  const registeredIds = await loadRegisteredCjProductIds();
  const summary = [];

  for (const category of categories) {
    const { keyword, marginPercent } = CATEGORY_CONFIG[category];
    console.log(`\n[${category}] searching CJ for "${keyword}" (margin ${marginPercent}%)...`);

    let page = 1;
    let done = 0;
    let skippedDup = 0;
    let skippedNoPrice = 0;
    let errors = 0;
    const registeredHere = [];

    while (done < count && page <= 10) {
      let results;
      try {
        results = await searchCjCatalog(keyword, page);
      } catch (err) {
        console.error(`  search page ${page} failed: ${err.message}`);
        break;
      }
      await sleep(REQUEST_DELAY_MS);
      if (results.length === 0) break;

      for (const item of results) {
        if (done >= count) break;
        if (!item.id || registeredIds.has(item.id)) { skippedDup++; continue; }

        let detail;
        try {
          detail = await getCjProductDetail(item.id);
        } catch (err) {
          console.error(`  detail fetch failed for ${item.id}: ${err.message}`);
          errors++;
          await sleep(REQUEST_DELAY_MS);
          continue;
        }
        await sleep(REQUEST_DELAY_MS);

        try {
          const result = await registerOneProduct({ item, detail, category, marginPercent, dryRun });
          if (result.skipped) { skippedNoPrice++; continue; }
          registeredIds.add(item.id);
          done++;
          registeredHere.push(result.registered);
          console.log(`  ${dryRun ? '[dry-run] would register' : 'registered'} (${done}/${count}): ${item.nameEn} — $${result.registered.cjPriceUsd} -> ${result.registered.apPrice.toLocaleString()} AP`);
        } catch (err) {
          console.error(`  register failed for ${item.id}: ${err.message}`);
          errors++;
        }
      }
      page++;
    }

    summary.push({ category, done, skippedDup, skippedNoPrice, errors });
  }

  console.log('\n=== Summary ===');
  for (const s of summary) {
    console.log(`${s.category}: ${s.done} ${dryRun ? 'would be registered' : 'registered'}, ${s.skippedDup} already-registered skipped, ${s.skippedNoPrice} no-price skipped, ${s.errors} errors`);
  }
  if (dryRun) {
    console.log('\nThis was a dry run — nothing was written. Re-run with --confirm to actually register these products.');
  }
  process.exit(0);
}

run().catch((err) => {
  console.error('Bulk registration failed:', err);
  process.exit(1);
});
