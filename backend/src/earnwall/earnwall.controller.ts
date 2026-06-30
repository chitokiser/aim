import { Controller, Get, Query } from '@nestjs/common';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { FirebaseService } from '../firebase/firebase.service';
import { PointsService } from '../points/points.service';

@Controller('earnwall')
export class EarnwallController {
  constructor(
    private config: ConfigService,
    private firebase: FirebaseService,
    private points: PointsService,
  ) {}

  // EarnWall calls GET /api/earnwall/postback when an offer is completed or reversed.
  // Signature: MD5(subId + transId + reward + SECRET_KEY)
  // Response must be exactly "ok".
  @Get('postback')
  async postback(
    @Query('subId') userId: string,
    @Query('transId') transId: string,
    @Query('reward') rewardStr: string,
    @Query('status') status: string,
    @Query('offer_name') offerName: string,
    @Query('signature') signature: string,
  ) {
    const secretKey = this.config.get<string>('EARNWALL_SECRET_KEY') ?? '';

    const expectedSig = crypto
      .createHash('md5')
      .update(userId + transId + rewardStr + secretKey)
      .digest('hex');

    if (!signature || signature !== expectedSig) return 'ERROR';

    const txRef = this.firebase.collection('earnwall_transactions').doc(transId);
    const existing = await txRef.get();
    if (existing.exists) return 'ok'; // idempotent

    const totalAp = Math.round(parseFloat(rewardStr) || 0);
    const isReversal = status === '2';

    await txRef.set({
      userId,
      transId,
      totalAp,
      offerName: offerName ?? '',
      status,
      processedAt: new Date().toISOString(),
    });

    if (isReversal) {
      const reverseAp = Math.floor(totalAp * 0.7);
      if (reverseAp > 0) {
        try {
          await this.points.deduct(
            userId,
            reverseAp,
            `EarnWall 취소 (${offerName ?? transId})`,
          );
        } catch {
          // If insufficient AP, log and continue — reversal is best-effort
        }
      }
      return 'ok';
    }

    const memberAp = Math.floor(totalAp * 0.7);
    const mentorAp = Math.floor(totalAp * 0.1);

    if (memberAp > 0) {
      await this.points.award(
        userId,
        memberAp,
        'earnwall_reward',
        `EarnWall 오퍼 완료: ${offerName ?? transId} (+${memberAp.toLocaleString()} AP)`,
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
          `멘토 수당: 멘티 EarnWall 오퍼 완료 (${totalAp} AP)`,
        );
      }
    }

    return 'ok';
  }
}
