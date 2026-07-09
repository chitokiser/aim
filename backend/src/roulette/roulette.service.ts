import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { LevelService } from '../level/level.service';

// Weighted EXP prize tiers — mostly small/mid prizes, jackpots are rare.
const PRIZE_TIERS: { min: number; max: number; weight: number }[] = [
  { min: 10, max: 100, weight: 50 },
  { min: 100, max: 1000, weight: 35 },
  { min: 1000, max: 5000, weight: 13 },
  { min: 5000, max: 10000, weight: 2 },
];

function pickPrize(): number {
  const totalWeight = PRIZE_TIERS.reduce((sum, tier) => sum + tier.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const tier of PRIZE_TIERS) {
    if (roll < tier.weight) {
      return Math.floor(Math.random() * (tier.max - tier.min + 1)) + tier.min;
    }
    roll -= tier.weight;
  }
  return PRIZE_TIERS[0].min;
}

function generateEventCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export interface RouletteEvent {
  id: string;
  code: string;
  label: string;
  active: boolean;
  createdAt: string;
  spinCount: number;
  totalExpAwarded: number;
  source: 'admin' | 'blog';
}

@Injectable()
export class RouletteService {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly levelService: LevelService,
  ) {}

  async createEvent(label: string, source: 'admin' | 'blog' = 'admin'): Promise<RouletteEvent> {
    const code = generateEventCode();
    const doc = {
      code,
      label,
      createdAt: new Date().toISOString(),
      active: true,
      spinCount: 0,
      totalExpAwarded: 0,
      source,
    };
    const ref = await this.firebase.collection('roulette_events').add(doc);
    return { id: ref.id, ...doc };
  }

  // Excludes the per-article "hidden TIGU" treasure events (source: 'blog')
  // from the admin management list — there's one per webzine post, so
  // listing them alongside intentional promo events would drown the latter.
  async listEvents(): Promise<RouletteEvent[]> {
    const snap = await this.firebase
      .collection('roulette_events')
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<RouletteEvent, 'id'>) }))
      .filter((event) => event.source !== 'blog');
  }

  private async getEventByCode(
    code: string,
  ): Promise<{ id: string; label: string; active: boolean } | null> {
    const snap = await this.firebase
      .collection('roulette_events')
      .where('code', '==', code)
      .limit(1)
      .get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    const data = doc.data() as Record<string, unknown>;
    return {
      id: doc.id,
      label: (data.label as string) ?? '',
      active: (data.active as boolean) ?? true,
    };
  }

  async getStatus(
    userId: string,
    code: string,
  ): Promise<{ eventLabel: string; alreadySpun: boolean; exp?: number }> {
    const event = await this.getEventByCode(code);
    if (!event || !event.active) throw new NotFoundException('Roulette event not found');

    const spinSnap = await this.firebase
      .collection('roulette_spins')
      .doc(`${userId}_${code}`)
      .get();
    if (spinSnap.exists) {
      const data = spinSnap.data() as Record<string, unknown>;
      return { eventLabel: event.label, alreadySpun: true, exp: data.exp as number };
    }
    return { eventLabel: event.label, alreadySpun: false };
  }

  async spin(
    userId: string,
    code: string,
  ): Promise<{ exp: number; level: number; totalExp: number; leveledUp: boolean }> {
    const event = await this.getEventByCode(code);
    if (!event || !event.active) throw new NotFoundException('Roulette event not found');

    const exp = pickPrize();
    const spinRef = this.firebase.collection('roulette_spins').doc(`${userId}_${code}`);
    try {
      // Deterministic doc ID + create() (not set()) — rejects a duplicate spin
      // atomically instead of racing a read-then-write check.
      await spinRef.create({
        userId,
        eventCode: code,
        exp,
        createdAt: new Date().toISOString(),
      });
    } catch {
      throw new ConflictException('Already spun for this event');
    }

    const eventRef = this.firebase.collection('roulette_events').doc(event.id);
    await this.firebase.getFirestore().runTransaction(async (tx) => {
      const snap = await tx.get(eventRef);
      const data = snap.data() as Record<string, unknown>;
      tx.update(eventRef, {
        spinCount: ((data.spinCount as number) ?? 0) + 1,
        totalExpAwarded: ((data.totalExpAwarded as number) ?? 0) + exp,
      });
    });

    const result = await this.levelService.awardExp(userId, exp);
    return { exp, level: result.level, totalExp: result.totalExp, leveledUp: result.leveledUp };
  }
}
