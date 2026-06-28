import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { FirebaseService } from '../firebase/firebase.service';
import { PointsService } from '../points/points.service';

@Controller('adgem')
export class AdgemController {
  constructor(
    private config: ConfigService,
    private firebase: FirebaseService,
    private points: PointsService,
  ) {}

  @Get('widget-config')
  @UseGuards(JwtAuthGuard)
  getWidgetConfig(@Request() req: { user: { sub: string } }) {
    const appId = this.config.get<string>('ADGEM_APP_ID') ?? '';
    return { appId, userId: req.user.sub };
  }

  // AdGem calls GET /api/adgem/postback when an offer is completed.
  // Verifier: MD5(user_id + transaction_id + postback_key)
  // `amount` is already in AP units (virtual currency set in AdGem dashboard).
  // Response must be exactly "1".
  @Get('postback')
  async postback(
    @Query('user_id') userId: string,
    @Query('amount') amountStr: string,
    @Query('appid') appId: string,
    @Query('transaction_id') transactionId: string,
    @Query('request_id') _requestId: string,
    @Query('verifier') verifier: string,
  ) {
    const postbackKey = this.config.get<string>('ADGEM_POSTBACK_KEY') ?? '';

    const expectedVerifier = crypto
      .createHash('md5')
      .update(userId + transactionId + postbackKey)
      .digest('hex');

    if (!verifier || verifier !== expectedVerifier) return '0';

    const txRef = this.firebase.collection('adgem_transactions').doc(transactionId);
    const existing = await txRef.get();
    if (existing.exists) return '1'; // idempotent

    // amount is in AP units (virtual currency); apply 70/10% split
    const totalAp = Math.round(parseFloat(amountStr) || 0);
    const memberAp = Math.floor(totalAp * 0.7);
    const mentorAp = Math.floor(totalAp * 0.1);

    await txRef.set({
      userId,
      transactionId,
      appId,
      totalAp,
      status: 'credited',
      processedAt: new Date().toISOString(),
    });

    if (memberAp > 0) {
      await this.points.award(
        userId,
        memberAp,
        'adgem_reward',
        `AdGem 오퍼 완료 (+${memberAp.toLocaleString()} AP)`,
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
          `멘토 수당: 멘티 AdGem 오퍼 완료 (${totalAp} AP)`,
        );
      }
    }

    return '1';
  }
}
