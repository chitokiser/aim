import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MissionsService } from '../missions/missions.service';
import { FirebaseService } from '../firebase/firebase.service';
import type { Query } from 'firebase-admin/firestore';

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    private readonly missions: MissionsService,
    private readonly firebase: FirebaseService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async runDailySettlement() {
    this.logger.log('Running daily mission settlement check…');

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 10);
    const cutoffISO = cutoff.toISOString();

    let query: Query = this.firebase.collection('missions');
    query = query.where('status', '==', 'active').where('createdAt', '<=', cutoffISO);

    const snap = await query.get();
    this.logger.log(`Found ${snap.size} mission(s) eligible for settlement`);

    const results: { missionId: string; result: unknown }[] = [];
    for (const doc of snap.docs) {
      try {
        const result = await this.missions.settleMission(doc.id);
        results.push({ missionId: doc.id, result });
        this.logger.log(`Settled mission ${doc.id}`);
      } catch (err) {
        this.logger.error(`Failed to settle mission ${doc.id}: ${(err as Error).message}`);
      }
    }

    return results;
  }
}
