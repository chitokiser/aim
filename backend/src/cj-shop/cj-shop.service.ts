import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FirebaseService } from '../firebase/firebase.service';
import { PointsService } from '../points/points.service';

const CJ_BASE = 'https://developers.cjdropshipping.com';
const AP_PER_USD = 10000;
const DEFAULT_MARGIN_PERCENT = 40;

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
  cjPriceUsd: number;
  marginPercent?: number;
}

interface UpdateProductDto {
  nameKo?: string;
  images?: string[];
  cjPriceUsd?: number;
  marginPercent?: number;
  active?: boolean;
}

export interface ShippingInfo {
  name: string;
  phone: string;
  address: string;
  detailAddress?: string;
  zip: string;
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
      cjPriceUsd: dto.cjPriceUsd,
      marginPercent,
      apPrice: computeApPrice(dto.cjPriceUsd, marginPercent),
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
    const fullAddress = [dto.shipping.address, dto.shipping.detailAddress].filter(Boolean).join(' ');

    try {
      const created = await this.cjRequest<{ orderId: string }>('POST', '/api2.0/v1/shopping/order/createOrderV3', {
        body: {
          orderNumber,
          shippingCustomerName: dto.shipping.name,
          shippingAddress: fullAddress,
          shippingCity: '',
          shippingCountryCode: 'KR',
          shippingCountry: 'Korea',
          shippingProvince: '',
          shippingZip: dto.shipping.zip,
          shippingPhone: dto.shipping.phone,
          products: [{ vid: product.cjVariantId, quantity }],
          logisticName: 'CJPacket Ordinary',
          fromCountryCode: 'CN',
        },
      });

      await this.cjRequest('POST', '/api2.0/v1/shopping/pay/payBalance', {
        body: { orderId: created.orderId },
      });

      const order = {
        userId,
        productId: dto.productId,
        cjOrderId: created.orderId,
        cjOrderNumber: orderNumber,
        quantity,
        apCharged: totalAp,
        shipping: dto.shipping,
        status: 'paid' as const,
        cjStatus: null as string | null,
        trackNumber: null as string | null,
        trackingProvider: null as string | null,
        failReason: null as string | null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const ref = await this.firebase.collection('cj_orders').add(order);
      return { id: ref.id, ...order };
    } catch (err) {
      await this.points.award(userId, totalAp, 'cj_shop_refund', 'CJ 주문 실패 환불');
      const failReason = err instanceof Error ? err.message : 'unknown error';
      const order = {
        userId,
        productId: dto.productId,
        cjOrderId: null as string | null,
        cjOrderNumber: orderNumber,
        quantity,
        apCharged: totalAp,
        shipping: dto.shipping,
        status: 'failed' as const,
        cjStatus: null as string | null,
        trackNumber: null as string | null,
        trackingProvider: null as string | null,
        failReason,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await this.firebase.collection('cj_orders').add(order);
      throw new BadRequestException(`주문 처리에 실패하여 AP가 환불되었습니다: ${failReason}`);
    }
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
}
