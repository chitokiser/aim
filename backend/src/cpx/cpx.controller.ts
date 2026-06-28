import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { FirebaseService } from '../firebase/firebase.service';
import { PointsService } from '../points/points.service';

@Controller('cpx')
export class CpxController {
  constructor(
    private config: ConfigService,
    private firebase: FirebaseService,
    private points: PointsService,
  ) {}

  // Returns widget config so the frontend can embed the CPX offerwall iframe.
  // The secure hash is computed server-side to keep CPX_SECURE_KEY private.
  @Get('widget-config')
  @UseGuards(JwtAuthGuard)
  getWidgetConfig(@Request() req: { user: { sub: string } }) {
    const userId = req.user.sub;
    const appId = this.config.get<string>('CPX_APP_ID') ?? '';
    const secureKey = this.config.get<string>('CPX_SECURE_KEY') ?? '';
    const secureHash = crypto.createHash('md5').update(userId + secureKey).digest('hex');
    return { appId, secureHash, userId };
  }

  // CPX Research calls this URL when a survey is completed.
  // Configure in CPX dashboard:
  //   {BACKEND_URL}/api/cpx/postback?trans_id={trans_id}&user_id={user_id}&amount_local={amount_local}&status={status}&hash={hash}
  @Get('postback')
  async postback(
    @Query('trans_id') transId: string,
    @Query('user_id') userId: string,
    @Query('amount_local') amountLocalStr: string,
    @Query('status') status: string,
    @Query('hash') hash: string,
  ) {
    const secureKey = this.config.get<string>('CPX_SECURE_KEY') ?? '';

    // Verify postback hash: MD5(trans_id + secure_key)
    const expectedHash = crypto.createHash('md5').update(transId + secureKey).digest('hex');
    if (!hash || hash !== expectedHash) return '0';

    if (status !== '1') return '0'; // not approved (2 = reversed)

    // Idempotency: prevent double-crediting if CPX retries the postback
    const txRef = this.firebase.collection('cpx_transactions').doc(transId);
    const existing = await txRef.get();
    if (existing.exists) return '1'; // already processed

    await txRef.set({
      userId,
      transId,
      amountLocal: amountLocalStr,
      processedAt: new Date().toISOString(),
    });

    // Revenue split: member 70%, mentor 10%, platform 20% (implicit)
    const amountUsd = parseFloat(amountLocalStr) || 0;
    const totalAp = Math.round(amountUsd * 10000);
    const memberAp = Math.floor(totalAp * 0.7);
    const mentorAp = Math.floor(totalAp * 0.1);

    if (memberAp > 0) {
      await this.points.award(
        userId,
        memberAp,
        'survey_reward',
        `CPX Research 설문 완료 (${amountLocalStr} USD)`,
      );
    }

    if (mentorAp > 0) {
      const userDoc = await this.firebase.collection('users').doc(userId).get();
      const mentorId = userDoc.data()?.mentorId as string | null;
      if (mentorId) {
        await this.points.award(
          mentorId,
          mentorAp,
          'mentor_bonus',
          `멘토 수당: 멘티 설문 완료 (${amountLocalStr} USD)`,
        );
      }
    }

    return '1';
  }
}
