import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegram } from 'telegraf';
import { FirebaseService } from '../firebase/firebase.service';
import { PointsService } from '../points/points.service';

const CJ_BASE = 'https://developers.cjdropshipping.com';
const AP_PER_USD = 10000;
const DEFAULT_MARGIN_PERCENT = 100;

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

interface RegisterProductDto {
  cjProductId: string;
  cjVariantId: string;
  nameKo: string;
  images?: string[];
  video?: string;
  description?: string;
  cjPriceUsd: number;
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
}

export interface ShippingInfo {
  name: string;
  phone: string;
  address: string;
  detailAddress?: string;
  zip: string;
  country?: string; // ISO country code, e.g. "KR" or "VN" — defaults to "KR" for older orders
}

interface CreateOrderDto {
  productId: string;
  quantity: number;
  shipping: ShippingInfo;
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

  async registerProduct(dto: RegisterProductDto) {
    const marginPercent = dto.marginPercent ?? DEFAULT_MARGIN_PERCENT;
    const product = {
      cjProductId: dto.cjProductId,
      cjVariantId: dto.cjVariantId,
      nameKo: dto.nameKo,
      images: dto.images ?? [],
      video: dto.video || null,
      description: dto.description || '',
      cjPriceUsd: dto.cjPriceUsd,
      marginPercent,
      apPrice: computeApPrice(dto.cjPriceUsd, marginPercent),
      category: dto.category || 'other',
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
    const cjPriceUsd = dto.cjPriceUsd ?? (current.cjPriceUsd as number);
    const update = { ...dto, marginPercent, cjPriceUsd, apPrice: computeApPrice(cjPriceUsd, marginPercent) };
    await ref.update(update);
    return { id, ...current, ...update };
  }

  async deleteProduct(id: string) {
    await this.firebase.collection('cj_products').doc(id).delete();
    return { ok: true };
  }

  async listAllProducts() {
    const snap = await this.firebase.collection('cj_products').orderBy('createdAt', 'desc').get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async listActiveProducts() {
    const snap = await this.firebase.collection('cj_products').where('active', '==', true).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async getProduct(id: string) {
    const snap = await this.firebase.collection('cj_products').doc(id).get();
    if (!snap.exists) throw new NotFoundException('Product not found');
    return { id: snap.id, ...snap.data() };
  }

  // ── Checkout (AP only) ────────────────────────────────────────────────────

  // NOTE: CJ prepaid balance is not funded yet, so we don't call createOrderV3/payBalance
  // automatically here. Instead the order is recorded as 'pending' and the admin is notified
  // via Telegram to fund the CJ wallet and place the order manually on CJ's own site.
  async createOrder(userId: string, dto: CreateOrderDto) {
    const quantity = Math.max(1, dto.quantity || 1);
    const productSnap = await this.firebase.collection('cj_products').doc(dto.productId).get();
    if (!productSnap.exists) throw new NotFoundException('Product not found');
    const product = productSnap.data() as Record<string, unknown>;
    if (product.active !== true) throw new BadRequestException('Product is not available');

    const apPrice = product.apPrice as number;
    const totalAp = apPrice * quantity;

    await this.points.deduct(userId, totalAp, `CJ Shop 주문: ${product.nameKo as string}`);

    const orderNumber = `AIM-${Date.now()}`;
    const userSnap = await this.firebase.collection('users').doc(userId).get();
    const userData = userSnap.data() as Record<string, unknown> | undefined;
    const username = (userData?.username as string) || (userData?.name as string) || userId;

    const order = {
      userId,
      productId: dto.productId,
      cjOrderId: null as string | null,
      cjOrderNumber: orderNumber,
      quantity,
      apCharged: totalAp,
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

    this.notifyAdmin(username, product.nameKo as string, quantity, totalAp, (product.cjPriceUsd as number) * quantity, dto.shipping);

    return { id: ref.id, ...order };
  }

  private notifyAdmin(
    username: string,
    productName: string,
    quantity: number,
    apCharged: number,
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
      `💰 차감 AP: ${apCharged.toLocaleString()} AP\n` +
      `💵 CJ 발주 필요 금액: $${cjCostUsd.toFixed(2)} (CJ 잔액 충전 후 수동 발주 필요)\n` +
      `🌍 배송국가: ${country}\n` +
      `🏠 배송지: ${shipping.name} / ${shipping.phone} / ${shipping.address} ${shipping.detailAddress ?? ''} (${shipping.zip})\n\n` +
      `🔍 [관리자 패널에서 확인](https://ai119.netlify.app/admin)`;

    new Telegram(botToken).sendMessage(adminId, msg, { parse_mode: 'Markdown' }).catch(() => {});
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
