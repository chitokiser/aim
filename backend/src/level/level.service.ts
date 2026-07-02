import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';

// EXP needed to advance from `level` to `level + 1` = level * 2 * 2 * 10000
const EXP_PER_LEVEL_UNIT = 2 * 2 * 10000;

// Level bonus: every time EXP is awarded, add an extra (current level * 1000) EXP on top
const LEVEL_BONUS_PER_LEVEL = 1000;

export function expNeededForLevel(level: number): number {
  return level * EXP_PER_LEVEL_UNIT;
}

export function levelFromTotalExp(totalExp: number): { level: number; exp: number } {
  let level = 1;
  let remaining = Math.max(0, totalExp);
  while (remaining >= expNeededForLevel(level)) {
    remaining -= expNeededForLevel(level);
    level += 1;
  }
  return { level, exp: remaining };
}

function totalExpFromLevelExp(level: number, exp: number): number {
  let total = exp;
  for (let l = 1; l < level; l++) total += expNeededForLevel(l);
  return total;
}

@Injectable()
export class LevelService {
  constructor(private readonly firebase: FirebaseService) {}

  private async adjustExp(
    userId: string,
    delta: number,
  ): Promise<{ level: number; exp: number; totalExp: number; leveledUp: boolean; leveledDown: boolean }> {
    const ref = this.firebase.collection('users').doc(userId);
    const snap = await ref.get();
    if (!snap.exists) return { level: 1, exp: 0, totalExp: 0, leveledUp: false, leveledDown: false };

    const data = snap.data() as Record<string, unknown>;
    const currentLevel = (data.level as number) ?? 1;
    const currentExp = (data.exp as number) ?? 0;
    const currentTotalExp = (data.totalExp as number) ?? totalExpFromLevelExp(currentLevel, currentExp);

    const newTotalExp = Math.max(0, currentTotalExp + delta);
    const { level, exp } = levelFromTotalExp(newTotalExp);

    await ref.update({ level, exp, totalExp: newTotalExp });
    return {
      level,
      exp,
      totalExp: newTotalExp,
      leveledUp: level > currentLevel,
      leveledDown: level < currentLevel,
    };
  }

  async awardExp(userId: string, amount: number) {
    const currentLevel = await this.getCurrentLevel(userId);
    const levelBonus = currentLevel * LEVEL_BONUS_PER_LEVEL;
    return this.adjustExp(userId, amount + levelBonus);
  }

  spendExp(userId: string, amount: number) {
    return this.adjustExp(userId, -amount);
  }

  private async getCurrentLevel(userId: string): Promise<number> {
    const snap = await this.firebase.collection('users').doc(userId).get();
    if (!snap.exists) return 1;
    return ((snap.data() as Record<string, unknown>).level as number) ?? 1;
  }

  async getSpendableExp(userId: string): Promise<number> {
    const snap = await this.firebase.collection('users').doc(userId).get();
    if (!snap.exists) return 0;
    const data = snap.data() as Record<string, unknown>;
    const level = (data.level as number) ?? 1;
    const exp = (data.exp as number) ?? 0;
    return (data.totalExp as number) ?? totalExpFromLevelExp(level, exp);
  }
}
