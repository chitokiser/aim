import {
  Controller,
  Get,
  Query,
  Request,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { FirebaseService } from '../firebase/firebase.service';
import { PointsService } from '../points/points.service';

export const AP_PACKAGES = [
  { id: 'ap_10000', ap: 10000, usd: 1.0, label: '10,000 AP', bonus: '' },
  { id: 'ap_55000', ap: 55000, usd: 5.0, label: '55,000 AP', bonus: '+10%' },
  { id: 'ap_120000', ap: 120000, usd: 10.0, label: '120,000 AP', bonus: '+20%' },
  { id: 'ap_650000', ap: 650000, usd: 50.0, label: '650,000 AP', bonus: '+30%' },
] as const;

function buildWidgetSign(params: Record<string, string>, secretKey: string): string {
  const sorted = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return crypto.createHash('md5').update(sorted + secretKey).digest('hex');
}

@Controller('paymentwall')
export class PaymentwallController {
  constructor(
    private config: ConfigService,
    private firebase: FirebaseService,
    private points: PointsService,
  ) {}

  @Get('packages')
  getPackages() {
    return AP_PACKAGES;
  }

  // Returns a signed Paymentwall widget URL for the requested package.
  // Called by the frontend when user selects an AP package.
  @Get('widget-url')
  @UseGuards(JwtAuthGuard)
  getWidgetUrl(
    @Request() req: { user: { sub: string } },
    @Query('packageId') packageId: string,
  ) {
    const pkg = AP_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) throw new BadRequestException('Invalid package ID');

    const publicKey = this.config.get<string>('PAYMENTWALL_PUBLIC_KEY') ?? '';
    const secretKey = this.config.get<string>('PAYMENTWALL_SECRET_KEY') ?? '';
    const widget = this.config.get<string>('PAYMENTWALL_WIDGET') ?? 'p1_1';
    const uid = req.user.sub;
    const ts = String(Math.floor(Date.now() / 1000));

    const params: Record<string, string> = {
      key: publicKey,
      uid,
      widget,
      amount: pkg.usd.toFixed(2),
      currencyCode: 'USD',
      ag_name: pkg.label,
      ag_external_id: pkg.id,
      ag_type: 'fixed',
      ts,
      sign_version: '2',
    };

    params.sign = buildWidgetSign(params, secretKey);

    const url =
      'https://api.paymentwall.com/api/subscription/?' +
      new URLSearchParams(params).toString();

    return { url, package: pkg };
  }

  // Paymentwall calls this endpoint (GET) after a successful payment.
  // Set this URL in the Paymentwall dashboard → Settings → Pingback URL:
  //   https://<RAILWAY_BACKEND_URL>/api/paymentwall/pingback
  @Get('pingback')
  async pingback(@Query() query: Record<string, string>) {
    const secretKey = this.config.get<string>('PAYMENTWALL_SECRET_KEY') ?? '';

    // Build signature from all params except sign/sign_version
    const { sign, sign_version: _sv, ...rest } = query;
    const expectedSign = buildWidgetSign(rest, secretKey);

    if (!sign || sign !== expectedSign) {
      return '0'; // Paymentwall requires '0' on failure
    }

    const type = parseInt(query.type ?? '0', 10);

    // Type 200 = chargeback/reversal — log but don't reverse AP for now
    if (type === 200) {
      await this.firebase.collection('paymentwall_chargebacks').add({
        uid: query.uid,
        ref: query.ref,
        goodsId: query.goodsid,
        recordedAt: new Date().toISOString(),
      });
      return '1';
    }

    // Only process type 0 (regular) and type 2 (recurring)
    if (type !== 0 && type !== 2) return '0';

    const uid = query.uid;
    const goodsId = query.goodsid;
    const ref = query.ref;

    // Idempotency guard — prevent double-credit on pingback retry
    const txRef = this.firebase.collection('paymentwall_transactions').doc(ref);
    const existing = await txRef.get();
    if (existing.exists) return '1';

    const pkg = AP_PACKAGES.find((p) => p.id === goodsId);
    if (!pkg) return '0';

    await txRef.set({
      uid,
      goodsId,
      ref,
      type,
      ap: pkg.ap,
      usd: pkg.usd,
      isTest: query.is_test === '1',
      processedAt: new Date().toISOString(),
    });

    await this.points.award(
      uid,
      pkg.ap,
      'paymentwall_topup',
      `Paymentwall 결제: ${pkg.label} ($${pkg.usd})`,
    );

    return '1';
  }
}
