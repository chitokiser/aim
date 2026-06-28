import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { FirebaseService } from '../firebase/firebase.service';
import { PointsService } from '../points/points.service';

@Controller('offerwall')
export class OfferwallController {
  constructor(
    private config: ConfigService,
    private firebase: FirebaseService,
    private points: PointsService,
  ) {}

  // Returns API key + userId so the frontend can build the iframe URL.
  @Get('widget-config')
  @UseGuards(JwtAuthGuard)
  getWidgetConfig(@Request() req: { user: { sub: string } }) {
    const apiKey = this.config.get<string>('OFFERWALL_API_KEY') ?? '';
    return { apiKey, userId: req.user.sub };
  }

  // offerwall.me calls POST /api/offerwall/postback when an offer is completed or reversed.
  // Signature: MD5(subId + transId + payout + SECRET_KEY)
  // Response must be exactly "OK".
  @Post('postback')
  async postback(
    @Body('subId') subId: string,
    @Body('transId') transId: string,
    @Body('offer_name') offerName: string,
    @Body('reward') rewardStr: string,
    @Body('payout') payoutStr: string,
    @Body('status') status: string,
    @Body('signature') signature: string,
  ) {
    const secretKey = this.config.get<string>('OFFERWALL_SECRET_KEY') ?? '';

    const expectedSig = crypto
      .createHash('md5')
      .update(subId + transId + payoutStr + secretKey)
      .digest('hex');

    if (!signature || signature !== expectedSig) return 'Invalid signature';

    const txRef = this.firebase.collection('offerwall_transactions').doc(transId);
    const existing = await txRef.get();

    if (status === '1') {
      if (existing.exists) return 'OK'; // idempotent

      const payoutUsd = parseFloat(payoutStr) || 0;
      const totalAp = Math.round(payoutUsd * 10000);
      const memberAp = Math.floor(totalAp * 0.7);
      const mentorAp = Math.floor(totalAp * 0.1);

      await txRef.set({
        userId: subId,
        transId,
        offerName: offerName ?? '',
        reward: rewardStr,
        payout: payoutStr,
        status: 'credited',
        processedAt: new Date().toISOString(),
      });

      if (memberAp > 0) {
        await this.points.award(
          subId,
          memberAp,
          'offerwall_reward',
          `오퍼월 완료: ${offerName ?? transId} (+${memberAp.toLocaleString()} AP)`,
        );
      }

      if (mentorAp > 0) {
        const userDoc = await this.firebase.collection('users').doc(subId).get();
        const mentorId = userDoc.data()?.mentorId as string | null;
        if (mentorId) {
          await this.points.award(
            mentorId,
            mentorAp,
            'mentor_bonus',
            `멘토 수당: 멘티 오퍼월 완료 (${payoutUsd} USD)`,
          );
        }
      }
    } else if (status === '2') {
      // Reversal — deduct AP if already credited
      const existingData = existing.exists ? (existing.data() as { status?: string }) : null;
      if (!existingData || existingData.status !== 'credited') return 'OK';

      const payoutUsd = parseFloat(payoutStr) || 0;
      const totalAp = Math.round(payoutUsd * 10000);
      const memberAp = Math.floor(totalAp * 0.7);

      await txRef.update({ status: 'reversed', reversedAt: new Date().toISOString() });

      if (memberAp > 0) {
        await this.points
          .deduct(subId, memberAp, `오퍼월 취소: ${offerName ?? transId}`)
          .catch(() => {});
      }
    }

    return 'OK';
  }
}
