import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';

// EXP needed to advance from `level` to `level + 1` = level * 2 * 2 * 10000
const EXP_PER_LEVEL_UNIT = 2 * 2 * 10000;

export function expNeededForLevel(level: number): number {
  return level * EXP_PER_LEVEL_UNIT;
}

@Injectable()
export class LevelService {
  constructor(private readonly firebase: FirebaseService) {}

  async awardExp(userId: string, amount: number): Promise<{ level: number; exp: number; leveledUp: boolean }> {
    const ref = this.firebase.collection('users').doc(userId);
    const snap = await ref.get();
    if (!snap.exists) return { level: 1, exp: 0, leveledUp: false };

    const data = snap.data() as Record<string, unknown>;
    let level = (data.level as number) ?? 1;
    let exp = (data.exp as number) ?? 0;
    const startLevel = level;

    exp += amount;
    while (exp >= expNeededForLevel(level)) {
      exp -= expNeededForLevel(level);
      level += 1;
    }

    await ref.update({ level, exp });
    return { level, exp, leveledUp: level > startLevel };
  }
}
