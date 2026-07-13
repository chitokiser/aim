import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FieldValue } from 'firebase-admin/firestore';
import { FirebaseService } from '../firebase/firebase.service';

function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

// Tracks estimated Gemini/Imagen spend against a hard monthly cap in
// Firestore. Gemini's "free tier" turned out to require prepaid billing that
// silently runs out, and Imagen cover images (~$0.04 each) are the dominant
// cost driver — every automated AI call site checks canSpend() before
// calling out and recordSpend() after a successful call, so a runaway cron
// can never blow past the budget the user actually wants to pay.
@Injectable()
export class AiBudgetService {
  private readonly logger = new Logger(AiBudgetService.name);
  private readonly capUsd: number;

  constructor(
    private readonly firebase: FirebaseService,
    private readonly config: ConfigService,
  ) {
    this.capUsd = Number(this.config.get<string>('AI_MONTHLY_BUDGET_USD')) || 10;
  }

  private get doc() {
    return this.firebase.collection('system_config').doc('ai_budget');
  }

  async canSpend(estimatedCostUsd: number): Promise<boolean> {
    const spent = await this.getMonthSpend();
    const ok = spent + estimatedCostUsd <= this.capUsd;
    if (!ok) {
      this.logger.warn(
        `Monthly AI budget cap ($${this.capUsd}) reached — spent $${spent.toFixed(2)} so far this month, skipping AI call.`,
      );
    }
    return ok;
  }

  async recordSpend(costUsd: number): Promise<void> {
    const month = currentMonthKey();
    const snap = await this.doc.get();
    const data = snap.exists ? (snap.data() as { month?: string } | undefined) : undefined;
    if (data?.month === month) {
      await this.doc.update({ spentUsd: FieldValue.increment(costUsd) });
    } else {
      await this.doc.set({ month, spentUsd: costUsd });
    }
  }

  async getMonthSpend(): Promise<number> {
    const month = currentMonthKey();
    const snap = await this.doc.get();
    const data = snap.exists ? (snap.data() as { month?: string; spentUsd?: number } | undefined) : undefined;
    return data?.month === month ? Number(data.spentUsd ?? 0) : 0;
  }
}
