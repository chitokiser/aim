import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegram } from 'telegraf';
import { FirebaseService } from '../firebase/firebase.service';
import { PointsService } from '../points/points.service';
import { LevelService } from '../level/level.service';
import { generateHashtags } from './hashtag.util';

const CJ_BASE = 'https://developers.cjdropshipping.com';
const AP_PER_USD = 10000;
const DEFAULT_MARGIN_PERCENT = 100;
// Reserve this fraction of the margin as mandatory AP so the mentor's 10% bonus
// (see mentorBonus below) always has a real AP funding source, even when the
// buyer pays the rest of the margin with EXP.
const MENTOR_FUND_RATIO = 0.1;
const MAX_FEATURED_PRODUCTS = 12;
const MAX_SUMMER_2026_PRODUCTS = 40;

interface CjEnvelope<T> {
  code?: number;
  result?: boolean;
  message?: string;
  data?: T;
}

interface CjAuthData {
  accessToken: string;
  accessTokenExpiryDate: string;
  refreshToken: string;
  refreshTokenExpiryDate: string;
}

export interface ProductVariant {
  vid: string;
  label: string;
  image?: string;
  cjPriceUsd: number;
  supplyApPrice: number;
  apPrice: number;
}

interface RegisterVariantInput {
  vid: string;
  label: string;
  image?: string;
  cjPriceUsd: number;
}

interface RegisterProductDto {
  cjProductId: string;
  variants: RegisterVariantInput[];
  nameKo: string;
  images?: string[];
  video?: string;
  description?: string;
  marginPercent?: number;
  category?: string;
}

interface UpdateProductDto {
  nameKo?: string;
  images?: string[];
  video?: string;
  description?: string;
  cjPriceUsd?: number;
  marginPercent?: number;
  active?: boolean;
  category?: string;
  featured?: boolean;
  summer2026?: boolean;
}

export interface ShippingInfo {
  name: string;
  phone: string;
  address: string;
  detailAddress?: string;
  zip: string;
  country?: string; // ISO country code, e.g. "KR" or "VN" — defaults to "KR" for older orders
}

export interface SavedAddress extends ShippingInfo {
  id: string;
  label: string;
  isDefault?: boolean;
}

interface CreateOrderDto {
  productId: string;
  quantity: number;
  shipping: ShippingInfo;
  expToUse?: number;
  selectedVid?: string;
}

interface BulkOrderItemDto {
  productId: string;
  quantity: number;
  selectedVid?: string;
  expToUse?: number;
}

interface CreateBulkOrderDto {
  items: BulkOrderItemDto[];
  shipping: ShippingInfo;
}

function computeSupplyApPrice(cjPriceUsd: number): number {
  return Math.ceil(cjPriceUsd * AP_PER_USD);
}

function computeApPrice(cjPriceUsd: number, marginPercent: number): number {
  return Math.ceil(cjPriceUsd * AP_PER_USD * (1 + marginPercent / 100));
}

@Injectable()
export class CjShopService {
  constructor(
    private readonly config: ConfigService,
    private readonly firebase: FirebaseService,
    private readonly points: PointsService,
    private readonly levelService: LevelService,
  ) {}

  // ── CJ API client ──────────────────────────────────────────────────────────

  private async getValidAccessToken(): Promise<string> {
    const ref = this.firebase.collection('config').doc('cj_api_token');
    const snap = await ref.get();
    const cached = snap.data() as Partial<CjAuthData> | undefined;
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
        const body = (await res.json()) as CjEnvelope<CjAuthData>;
        if (body.result && body.data) {
          await ref.set(body.data);
          return body.data.accessToken;
        }
      } catch {
        // fall through to full re-auth
      }
    }

    const apiKey = this.config.get<string>('CJ_DROPSHIPPING_API_KEY') ?? '';
    const res = await fetch(`${CJ_BASE}/api2.0/v1/authentication/getAccessToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    });
    const body = (await res.json()) as CjEnvelope<CjAuthData>;
    if (!body.result || !body.data) {
      throw new BadRequestException(`CJ 인증 실패: ${body.message ?? 'unknown error'}`);
    }
    await ref.set(body.data);
    return body.data.accessToken;
  }

  private async cjRequest<T>(
    method: 'GET' | 'POST',
    path: string,
    opts: { query?: Record<string, string>; body?: unknown } = {},
  ): Promise<T> {
    const url = new URL(`${CJ_BASE}${path}`);
    if (opts.query) {
      Object.entries(opts.query).forEach(([k, v]) => url.searchParams.set(k, v));
    }
    const accessToken = await this.getValidAccessToken();
    const res = await fetch(url.toString(), {
      method,
      headers: { 'Content-Type': 'application/json', 'CJ-Access-Token': accessToken },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const json = (await res.json()) as CjEnvelope<T>;
    if (!res.ok || json.result === false) {
      throw new BadRequestException(`CJ API 오류: ${json.message ?? res.statusText}`);
    }
    return json.data as T;
  }

  // ── Admin: CJ catalog browsing ───────────────────────────────────────────

  searchCjCatalog(keyword: string, page = 1) {
    return this.cjRequest('GET', '/api2.0/v1/product/listV2', {
      query: { keyWord: keyword, page: String(page), size: '20' },
    });
  }

  getCjProductDetail(pid: string) {
    return this.cjRequest('GET', '/api2.0/v1/product/query', { query: { pid } });
  }

  getCjBalance() {
    return this.cjRequest('GET', '/api2.0/v1/shopping/pay/getBalance');
  }

  // ── Admin: curated product catalog (cj_products) ─────────────────────────

  // Sequential, human-readable product number so users/admins can reference or
  // search a product without its long Firestore doc id / CJ product id.
  private async getNextProductNumber(): Promise<number> {
    const counterRef = this.firebase.collection('config').doc('cj_product_number_counter');
    return this.firebase.getFirestore().runTransaction(async (tx) => {
      const snap = await tx.get(counterRef);
      const next = ((snap.data()?.value as number | undefined) ?? 0) + 1;
      tx.set(counterRef, { value: next }, { merge: true });
      return next;
    });
  }

  // Products registered before productNumber existed have none — assign one
  // lazily (oldest first, so numbering roughly matches registration order).
  // One transaction for the whole batch — a prior per-doc-transaction version
  // did N sequential round trips to Firestore and made the products list
  // endpoint time out once the catalog grew past a handful of items.
  private async backfillMissingProductNumbers(
    docs: FirebaseFirestore.QueryDocumentSnapshot[],
  ): Promise<Map<string, number>> {
    const missing = docs
      .filter((d) => (d.data() as Record<string, unknown>).productNumber === undefined)
      .sort((a, b) => ((a.data().createdAt as string) ?? '').localeCompare((b.data().createdAt as string) ?? ''))
      // Firestore caps writes per transaction at 500; leave room for the counter write.
      .slice(0, 490);
    const assigned = new Map<string, number>();
    if (missing.length === 0) return assigned;

    const counterRef = this.firebase.collection('config').doc('cj_product_number_counter');
    await this.firebase.getFirestore().runTransaction(async (tx) => {
      const counterSnap = await tx.get(counterRef);
      let next = (counterSnap.data()?.value as number | undefined) ?? 0;
      for (const doc of missing) {
        next += 1;
        assigned.set(doc.id, next);
        tx.update(doc.ref, { productNumber: next });
      }
      tx.set(counterRef, { value: next }, { merge: true });
    });
    return assigned;
  }

  async registerProduct(dto: RegisterProductDto) {
    if (!dto.variants || dto.variants.length === 0) {
      throw new BadRequestException('At least one variant is required');
    }
    const marginPercent = dto.marginPercent ?? DEFAULT_MARGIN_PERCENT;
    const variants: ProductVariant[] = dto.variants.map((v) => ({
      vid: v.vid,
      label: v.label,
      image: v.image,
      cjPriceUsd: v.cjPriceUsd,
      supplyApPrice: computeSupplyApPrice(v.cjPriceUsd),
      apPrice: computeApPrice(v.cjPriceUsd, marginPercent),
    }));
    const primary = variants[0];
    const category = dto.category || 'other';
    const productNumber = await this.getNextProductNumber();
    const product = {
      productNumber,
      cjProductId: dto.cjProductId,
      nameKo: dto.nameKo,
      images: dto.images ?? [],
      video: dto.video || null,
      description: dto.description || '',
      marginPercent,
      variants,
      // Mirror the primary (first) variant's pricing at the top level so the
      // shop grid / EXP badge, which read these fields directly, keep working
      // for both single- and multi-variant products.
      cjVariantId: primary.vid,
      cjPriceUsd: primary.cjPriceUsd,
      supplyApPrice: primary.supplyApPrice,
      apPrice: primary.apPrice,
      category,
      hashtags: generateHashtags(dto.nameKo, category),
      active: true,
      createdAt: new Date().toISOString(),
    };
    const ref = await this.firebase.collection('cj_products').add(product);
    return { id: ref.id, ...product };
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    const ref = this.firebase.collection('cj_products').doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundException('Product not found');
    const current = snap.data() as Record<string, unknown>;
    const marginPercent = dto.marginPercent ?? (current.marginPercent as number);

    if (dto.featured === true && current.featured !== true) {
      const featuredSnap = await this.firebase.collection('cj_products').where('featured', '==', true).get();
      if (featuredSnap.size >= MAX_FEATURED_PRODUCTS) {
        throw new BadRequestException(`Featured products are capped at ${MAX_FEATURED_PRODUCTS}`);
      }
    }

    if (dto.summer2026 === true && current.summer2026 !== true) {
      const summerSnap = await this.firebase.collection('cj_products').where('summer2026', '==', true).get();
      if (summerSnap.size >= MAX_SUMMER_2026_PRODUCTS) {
        throw new BadRequestException(`Summer 2026 products are capped at ${MAX_SUMMER_2026_PRODUCTS}`);
      }
    }

    // Legacy products (registered before variant support) have no `variants`
    // array — synthesize a single implicit variant from their top-level fields.
    const currentVariants: ProductVariant[] = (current.variants as ProductVariant[] | undefined) ?? [
      {
        vid: current.cjVariantId as string,
        label: current.nameKo as string,
        cjPriceUsd: (dto.cjPriceUsd ?? current.cjPriceUsd) as number,
        supplyApPrice: 0,
        apPrice: 0,
      },
    ];
    const variants = currentVariants.map((v) => ({
      ...v,
      supplyApPrice: computeSupplyApPrice(v.cjPriceUsd),
      apPrice: computeApPrice(v.cjPriceUsd, marginPercent),
    }));
    const primary = variants[0];
    const nameKo = dto.nameKo ?? (current.nameKo as string);
    const category = dto.category ?? (current.category as string);

    const update = {
      ...dto,
      marginPercent,
      variants,
      cjPriceUsd: primary.cjPriceUsd,
      supplyApPrice: primary.supplyApPrice,
      apPrice: primary.apPrice,
      ...(dto.nameKo || dto.category ? { hashtags: generateHashtags(nameKo, category) } : {}),
    };
    await ref.update(update);
    return { id, ...current, ...update };
  }

  async deleteProduct(id: string) {
    await this.firebase.collection('cj_products').doc(id).delete();
    return { ok: true };
  }

  async listAllProducts() {
    const snap = await this.firebase.collection('cj_products').orderBy('createdAt', 'desc').get();
    const assigned = await this.backfillMissingProductNumbers(snap.docs);
    return snap.docs.map((d) => ({ id: d.id, ...d.data(), ...(assigned.has(d.id) ? { productNumber: assigned.get(d.id) } : {}) }));
  }

  async listFeaturedProducts() {
    const snap = await this.firebase
      .collection('cj_products')
      .where('active', '==', true)
      .where('featured', '==', true)
      .limit(MAX_FEATURED_PRODUCTS)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async listSummer2026Products() {
    const snap = await this.firebase
      .collection('cj_products')
      .where('active', '==', true)
      .where('summer2026', '==', true)
      .limit(MAX_SUMMER_2026_PRODUCTS)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async listActiveProducts() {
    const snap = await this.firebase.collection('cj_products').where('active', '==', true).get();
    const assigned = await this.backfillMissingProductNumbers(snap.docs);
    return snap.docs.map((d) => ({ id: d.id, ...d.data(), ...(assigned.has(d.id) ? { productNumber: assigned.get(d.id) } : {}) }));
  }

  async getProduct(id: string) {
    const snap = await this.firebase.collection('cj_products').doc(id).get();
    if (snap.exists) return { id: snap.id, ...snap.data() };

    // Netlify's CDN 301-redirects mixed-case product URLs to lowercase, but
    // Firestore auto-generated doc IDs are case-sensitive — fall back to a
    // case-insensitive scan so those links still resolve.
    const match = await this.findProductDocByIdCaseInsensitive(id);
    if (!match) throw new NotFoundException('Product not found');
    return { id: match.id, ...match.data() };
  }

  private async findProductDocByIdCaseInsensitive(id: string) {
    const all = await this.firebase.collection('cj_products').get();
    return all.docs.find((d) => d.id.toLowerCase() === id.toLowerCase()) ?? null;
  }

  private async resolveProductDoc(productId: string): Promise<{ id: string; data: Record<string, unknown> }> {
    let snap = await this.firebase.collection('cj_products').doc(productId).get();
    let id = productId;
    if (!snap.exists) {
      // Netlify's CDN 301-redirects mixed-case product URLs to lowercase,
      // so the checkout form may submit a lowercased id — resolve it back.
      const match = await this.findProductDocByIdCaseInsensitive(productId);
      if (!match) throw new NotFoundException('Product not found');
      snap = match;
      id = match.id;
    }
    const data = snap.data() as Record<string, unknown>;
    if (data.active !== true) throw new BadRequestException('Product is not available');
    return { id, data };
  }

  private computePricing(product: Record<string, unknown>, quantity: number, selectedVid?: string) {
    const variants = product.variants as ProductVariant[] | undefined;
    const selectedVariant = variants?.find((v) => v.vid === selectedVid) ?? variants?.[0] ?? null;
    const apPrice = selectedVariant?.apPrice ?? (product.apPrice as number);
    // Legacy products registered before EXP-payment support have no supplyApPrice —
    // fall back to apPrice so their maxExpPayable is 0 (no EXP discount) until re-saved.
    const supplyApPrice = selectedVariant?.supplyApPrice ?? (product.supplyApPrice as number) ?? apPrice;
    const totalPrice = apPrice * quantity;
    const marginTotal = Math.max(0, apPrice - supplyApPrice) * quantity;
    const maxExpPayable = Math.floor(marginTotal * (1 - MENTOR_FUND_RATIO));
    return { selectedVariant, apPrice, supplyApPrice, totalPrice, maxExpPayable };
  }

  // ── Checkout (AP only) ────────────────────────────────────────────────────

  // NOTE: CJ prepaid balance is not funded yet, so we don't call createOrderV3/payBalance
  // automatically here. Instead the order is recorded as 'pending' and the admin is notified
  // via Telegram to fund the CJ wallet and place the order manually on CJ's own site.
  async createOrder(userId: string, dto: CreateOrderDto) {
    const quantity = Math.max(1, dto.quantity || 1);
    const { id: productId, data: product } = await this.resolveProductDoc(dto.productId);
    const { selectedVariant, totalPrice, maxExpPayable } = this.computePricing(product, quantity, dto.selectedVid);

    const requestedExp = Math.max(0, Math.floor(dto.expToUse || 0));
    const userSpendableExp = await this.levelService.getSpendableExp(userId);
    const expUsed = Math.min(requestedExp, maxExpPayable, userSpendableExp);
    const apToCharge = totalPrice - expUsed;

    const userSnap = await this.firebase.collection('users').doc(userId).get();
    const userData = userSnap.data() as Record<string, unknown> | undefined;
    const username = (userData?.username as string) || (userData?.name as string) || userId;
    const mentorId = (userData?.mentorId as string | null) ?? null;

    await this.points.deduct(userId, apToCharge, `CJ Shop 주문: ${product.nameKo as string}`);
    if (expUsed > 0) {
      await this.levelService.spendExp(userId, expUsed);
    }

    const mentorBonus = Math.floor(apToCharge * 0.1);
    if (mentorId && mentorBonus > 0) {
      await this.points.award(mentorId, mentorBonus, 'mentor_bonus', `멘토 수당: 멘티 CJ 쇼핑몰 구매 (${product.nameKo as string})`);
    }

    const orderNumber = `AIM-${Date.now()}`;

    const order = {
      userId,
      productId,
      variantVid: selectedVariant?.vid ?? null,
      variantLabel: selectedVariant?.label ?? null,
      cjOrderId: null as string | null,
      cjOrderNumber: orderNumber,
      batchId: null as string | null,
      quantity,
      totalPrice,
      expUsed,
      apCharged: apToCharge,
      mentorId,
      mentorBonus: mentorId ? mentorBonus : 0,
      shipping: dto.shipping,
      status: 'pending' as const,
      cjStatus: null as string | null,
      trackNumber: null as string | null,
      trackingProvider: null as string | null,
      failReason: null as string | null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const ref = await this.firebase.collection('cj_orders').add(order);

    const productLabel = selectedVariant?.label ? `${product.nameKo as string} (${selectedVariant.label})` : (product.nameKo as string);
    this.notifyAdmin(username, productLabel, quantity, apToCharge, expUsed, mentorId ? mentorBonus : 0, (selectedVariant?.cjPriceUsd ?? (product.cjPriceUsd as number)) * quantity, dto.shipping);

    return { id: ref.id, ...order };
  }

  // Cart checkout: charges + creates one cj_orders doc per line item (sharing
  // a single shipping address and a common batchId), then sends ONE combined
  // Telegram notification instead of one per item. Items are grouped by their
  // underlying cjProductId in the notification because CJ Dropshipping ships
  // each product from its own supplier warehouse — lines sharing the same
  // cjProductId (i.e. different options of the same listing) are likely to
  // ship together, but different listings are very likely separate parcels.
  // Combining shipments across different listings is a manual best-effort the
  // admin does when placing the order on CJ's site, never guaranteed.
  async createBulkOrder(userId: string, dto: CreateBulkOrderDto) {
    if (!dto.items || dto.items.length === 0) throw new BadRequestException('Cart is empty');

    const batchId = `AIM-BATCH-${Date.now()}`;
    const userSnap = await this.firebase.collection('users').doc(userId).get();
    const userData = userSnap.data() as Record<string, unknown> | undefined;
    const username = (userData?.username as string) || (userData?.name as string) || userId;
    const mentorId = (userData?.mentorId as string | null) ?? null;

    let remainingSpendableExp = await this.levelService.getSpendableExp(userId);
    const createdOrders: Record<string, unknown>[] = [];
    const notifyLines: { productLabel: string; cjProductId: string; quantity: number; apCharged: number; expUsed: number; cjCostUsd: number }[] = [];
    let totalApCharged = 0;
    let totalExpUsed = 0;
    let totalMentorBonus = 0;

    for (const item of dto.items) {
      const quantity = Math.max(1, item.quantity || 1);
      const { id: productId, data: product } = await this.resolveProductDoc(item.productId);
      const { selectedVariant, totalPrice, maxExpPayable } = this.computePricing(product, quantity, item.selectedVid);

      const requestedExp = Math.max(0, Math.floor(item.expToUse || 0));
      const expUsed = Math.min(requestedExp, maxExpPayable, remainingSpendableExp);
      remainingSpendableExp -= expUsed;
      const apToCharge = totalPrice - expUsed;

      await this.points.deduct(userId, apToCharge, `CJ Shop 주문: ${product.nameKo as string}`);
      if (expUsed > 0) {
        await this.levelService.spendExp(userId, expUsed);
      }

      const mentorBonus = Math.floor(apToCharge * 0.1);
      if (mentorId && mentorBonus > 0) {
        await this.points.award(mentorId, mentorBonus, 'mentor_bonus', `멘토 수당: 멘티 CJ 쇼핑몰 구매 (${product.nameKo as string})`);
      }

      const orderNumber = `AIM-${Date.now()}-${createdOrders.length}`;
      const order = {
        userId,
        productId,
        variantVid: selectedVariant?.vid ?? null,
        variantLabel: selectedVariant?.label ?? null,
        cjOrderId: null as string | null,
        cjOrderNumber: orderNumber,
        batchId,
        quantity,
        totalPrice,
        expUsed,
        apCharged: apToCharge,
        mentorId,
        mentorBonus: mentorId ? mentorBonus : 0,
        shipping: dto.shipping,
        status: 'pending' as const,
        cjStatus: null as string | null,
        trackNumber: null as string | null,
        trackingProvider: null as string | null,
        failReason: null as string | null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const ref = await this.firebase.collection('cj_orders').add(order);
      createdOrders.push({ id: ref.id, ...order });

      const productLabel = selectedVariant?.label ? `${product.nameKo as string} (${selectedVariant.label})` : (product.nameKo as string);
      notifyLines.push({
        productLabel,
        cjProductId: product.cjProductId as string,
        quantity,
        apCharged: apToCharge,
        expUsed,
        cjCostUsd: (selectedVariant?.cjPriceUsd ?? (product.cjPriceUsd as number)) * quantity,
      });
      totalApCharged += apToCharge;
      totalExpUsed += expUsed;
      totalMentorBonus += mentorId ? mentorBonus : 0;
    }

    this.notifyAdminBulk(username, notifyLines, totalApCharged, totalExpUsed, totalMentorBonus, dto.shipping);

    return { batchId, orders: createdOrders };
  }

  private notifyAdmin(
    username: string,
    productName: string,
    quantity: number,
    apCharged: number,
    expUsed: number,
    mentorBonus: number,
    cjCostUsd: number,
    shipping: ShippingInfo,
  ) {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const adminId = this.config.get<string>('ADMIN_TELEGRAM_ID');
    if (!botToken || !adminId) return;

    const country = shipping.country || 'KR';
    const msg =
      `🛒 *CJ 쇼핑몰 주문 접수*\n\n` +
      `👤 회원: ${username}\n` +
      `📦 상품: ${productName} x${quantity}\n` +
      `💰 차감 AP: ${apCharged.toLocaleString()} AP` + (expUsed > 0 ? ` (+ EXP 결제 ${expUsed.toLocaleString()})\n` : `\n`) +
      (mentorBonus > 0 ? `🎁 멘토 수당: ${mentorBonus.toLocaleString()} AP\n` : ``) +
      `💵 CJ 발주 필요 금액: $${cjCostUsd.toFixed(2)} (CJ 잔액 충전 후 수동 발주 필요)\n` +
      `🌍 배송국가: ${country}\n` +
      `🏠 배송지: ${shipping.name} / ${shipping.phone} / ${shipping.address} ${shipping.detailAddress ?? ''} (${shipping.zip})\n\n` +
      `🔍 [관리자 패널에서 확인](https://ai119.netlify.app/admin)`;

    new Telegram(botToken).sendMessage(adminId, msg, { parse_mode: 'Markdown' }).catch(() => {});
  }

  private notifyAdminBulk(
    username: string,
    lines: { productLabel: string; cjProductId: string; quantity: number; apCharged: number; expUsed: number; cjCostUsd: number }[],
    totalApCharged: number,
    totalExpUsed: number,
    totalMentorBonus: number,
    shipping: ShippingInfo,
  ) {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const adminId = this.config.get<string>('ADMIN_TELEGRAM_ID');
    if (!botToken || !adminId) return;

    const country = shipping.country || 'KR';
    const groups = new Map<string, typeof lines>();
    for (const line of lines) {
      const key = line.cjProductId || line.productLabel;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(line);
    }
    const totalCjCostUsd = lines.reduce((sum, l) => sum + l.cjCostUsd, 0);

    const groupText = Array.from(groups.values())
      .map((group) => {
        const items = group.map((l) => `  • ${l.productLabel} x${l.quantity}`).join('\n');
        const combineHint = group.length > 1 ? ' (같은 상품 — 함께 배송 가능)' : '';
        return `${items}${combineHint}`;
      })
      .join('\n');

    const msg =
      `🛒 *CJ 쇼핑몰 일괄 주문 접수* (${lines.length}개 상품)\n\n` +
      `👤 회원: ${username}\n` +
      `📦 주문 내역:\n${groupText}\n\n` +
      `💰 총 차감 AP: ${totalApCharged.toLocaleString()} AP` + (totalExpUsed > 0 ? ` (+ EXP 결제 ${totalExpUsed.toLocaleString()})\n` : `\n`) +
      (totalMentorBonus > 0 ? `🎁 멘토 수당: ${totalMentorBonus.toLocaleString()} AP\n` : ``) +
      `💵 CJ 발주 필요 금액: $${totalCjCostUsd.toFixed(2)} (CJ 잔액 충전 후 수동 발주 필요)\n` +
      `🌍 배송국가: ${country}\n` +
      `🏠 배송지: ${shipping.name} / ${shipping.phone} / ${shipping.address} ${shipping.detailAddress ?? ''} (${shipping.zip})\n\n` +
      `⚠️ 서로 다른 상품은 CJ 공급처가 달라 개별 배송될 수 있습니다. 가능한 경우 발주 시 배송 통합을 시도해 주세요.\n\n` +
      `🔍 [관리자 패널에서 확인](https://ai119.netlify.app/admin)`;

    new Telegram(botToken).sendMessage(adminId, msg, { parse_mode: 'Markdown' }).catch(() => {});
  }

  // ── Saved shipping addresses ──────────────────────────────────────────────
  // Stored directly on the user doc (users/{uid}.shippingAddresses) so a buyer
  // enters their address once and can reuse/select it on every future order
  // instead of retyping it — this is purely a checkout convenience, not a
  // Firestore collection of its own.

  async listAddresses(userId: string): Promise<SavedAddress[]> {
    const snap = await this.firebase.collection('users').doc(userId).get();
    return ((snap.data()?.shippingAddresses as SavedAddress[] | undefined) ?? []);
  }

  async saveAddress(userId: string, input: ShippingInfo & { label?: string }): Promise<SavedAddress[]> {
    const existing = await this.listAddresses(userId);
    const address: SavedAddress = {
      id: `addr_${Date.now()}`,
      label: input.label?.trim() || input.name,
      name: input.name,
      phone: input.phone,
      address: input.address,
      detailAddress: input.detailAddress,
      zip: input.zip,
      country: input.country || 'KR',
      isDefault: existing.length === 0,
    };
    const updated = [...existing, address];
    await this.firebase.collection('users').doc(userId).update({ shippingAddresses: updated });
    return updated;
  }

  async deleteAddress(userId: string, addressId: string): Promise<SavedAddress[]> {
    const existing = await this.listAddresses(userId);
    const removedWasDefault = existing.find((a) => a.id === addressId)?.isDefault === true;
    let updated = existing.filter((a) => a.id !== addressId);
    if (removedWasDefault && updated.length > 0) {
      updated = updated.map((a, i) => ({ ...a, isDefault: i === 0 }));
    }
    await this.firebase.collection('users').doc(userId).update({ shippingAddresses: updated });
    return updated;
  }

  async setDefaultAddress(userId: string, addressId: string): Promise<SavedAddress[]> {
    const existing = await this.listAddresses(userId);
    if (!existing.some((a) => a.id === addressId)) throw new NotFoundException('Address not found');
    const updated = existing.map((a) => ({ ...a, isDefault: a.id === addressId }));
    await this.firebase.collection('users').doc(userId).update({ shippingAddresses: updated });
    return updated;
  }

  async getMyOrders(userId: string) {
    const snap = await this.firebase.collection('cj_orders').where('userId', '==', userId).get();
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const aT = ((a as Record<string, unknown>).createdAt as string) ?? '';
        const bT = ((b as Record<string, unknown>).createdAt as string) ?? '';
        return bT.localeCompare(aT);
      });
  }

  async getAllOrders() {
    const snap = await this.firebase.collection('cj_orders').get();
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const aT = ((a as Record<string, unknown>).createdAt as string) ?? '';
        const bT = ((b as Record<string, unknown>).createdAt as string) ?? '';
        return bT.localeCompare(aT);
      });
  }

  async refreshOrderStatus(id: string) {
    const ref = this.firebase.collection('cj_orders').doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundException('Order not found');
    const order = snap.data() as Record<string, unknown>;
    if (!order.cjOrderId) throw new BadRequestException('No CJ order id to refresh');

    const detail = await this.cjRequest<{ orderStatus: string; trackNumber?: string; trackingProvider?: string }>(
      'GET',
      '/api2.0/v1/shopping/order/getOrderDetail',
      { query: { orderId: order.cjOrderId as string } },
    );

    const update = {
      cjStatus: detail.orderStatus,
      trackNumber: detail.trackNumber ?? null,
      trackingProvider: detail.trackingProvider ?? null,
      updatedAt: new Date().toISOString(),
    };
    await ref.update(update);
    return { id, ...order, ...update };
  }

  // Admin manually marks an order as fulfilled after placing it on CJ's own site
  // and paying from the (manually topped-up) CJ wallet.
  async completeOrder(id: string, trackNumber?: string, trackingProvider?: string) {
    const ref = this.firebase.collection('cj_orders').doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundException('Order not found');
    const order = snap.data() as Record<string, unknown>;

    const update = {
      status: 'completed' as const,
      trackNumber: trackNumber || (order.trackNumber as string | null) || null,
      trackingProvider: trackingProvider || (order.trackingProvider as string | null) || null,
      updatedAt: new Date().toISOString(),
    };
    await ref.update(update);
    return { id, ...order, ...update };
  }
}
