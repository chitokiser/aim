import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Telegraf } from 'telegraf';
import { FirebaseService } from '../firebase/firebase.service';
import { PointsService } from '../points/points.service';

const BLACK_RULES = {
  leaveWithin1h: -10,
  leaveWithin7d: -5,
  stay30d: 3,
  completeMission: 1,
};

const BLACK_THRESHOLDS = { black: -50, warning: -20 };

@Injectable()
export class GroupJoinsService {
  private readonly logger = new Logger(GroupJoinsService.name);
  private rewardBot: Telegraf | null = null;

  constructor(
    private readonly firebase: FirebaseService,
    private readonly points: PointsService,
  ) {
    const token = process.env.REWARD_BOT_TOKEN;
    if (token) {
      this.rewardBot = new Telegraf(token);
    }
  }

  // ── Recording ─────────────────────────────────────────────────────────────

  async recordJoin(telegramId: string, chatId: string): Promise<void> {
    const userSnap = await this.firebase
      .collection('users')
      .where('telegramId', '==', String(telegramId))
      .limit(1)
      .get();
    if (userSnap.empty) return;

    const userDoc = userSnap.docs[0];
    const userId = userDoc.id;

    // Find active follow_join missions for this group
    const missionsSnap = await this.firebase
      .collection('missions')
      .where('status', '==', 'active')
      .where('missionType', '==', 'follow_join')
      .where('targetGroupId', '==', String(chatId))
      .get();

    for (const missionDoc of missionsSnap.docs) {
      const mission = missionDoc.data();
      const missionId = missionDoc.id;

      // Skip if already has a join record for this mission
      const existing = await this.firebase
        .collection('group_joins')
        .where('userId', '==', userId)
        .where('missionId', '==', missionId)
        .where('status', 'in', ['pending', 'rewarded'])
        .limit(1)
        .get();
      if (!existing.empty) continue;

      const daysRequired: number = (mission.minDaysRequired as number) ?? 7;
      const rewardAP: number = (mission.rewardPerUnit as number) ?? (mission.reward as number) ?? 1000;
      const rewardAfter = new Date();
      rewardAfter.setDate(rewardAfter.getDate() + daysRequired);

      await this.firebase.collection('group_joins').add({
        telegramId: String(telegramId),
        userId,
        chatId: String(chatId),
        missionId,
        status: 'pending',
        joinedAt: new Date().toISOString(),
        rewardAfter: rewardAfter.toISOString(),
        rewardAP,
        daysRequired,
      });

      this.logger.log(`Recorded join: user=${userId} mission=${missionId} rewardAfter=${rewardAfter.toISOString()}`);
    }
  }

  async recordLeave(telegramId: string, chatId: string): Promise<void> {
    const userSnap = await this.firebase
      .collection('users')
      .where('telegramId', '==', String(telegramId))
      .limit(1)
      .get();
    if (userSnap.empty) return;

    const userDoc = userSnap.docs[0];
    const userId = userDoc.id;
    const now = new Date();
    const nowIso = now.toISOString();

    // Find pending joins for this group
    const joinsSnap = await this.firebase
      .collection('group_joins')
      .where('userId', '==', userId)
      .where('chatId', '==', String(chatId))
      .where('status', '==', 'pending')
      .get();

    for (const joinDoc of joinsSnap.docs) {
      const join = joinDoc.data();
      const joinedAt = new Date(join.joinedAt as string);
      const diffHours = (now.getTime() - joinedAt.getTime()) / 3_600_000;
      const diffDays = diffHours / 24;

      let scoreDelta = 0;
      if (diffHours < 1) scoreDelta = BLACK_RULES.leaveWithin1h;
      else if (diffDays < 7) scoreDelta = BLACK_RULES.leaveWithin7d;

      await joinDoc.ref.update({ status: 'left', leftAt: nowIso });

      if (scoreDelta !== 0) {
        await this.applyBlackScore(userId, scoreDelta);
      }
    }
  }

  // ── Cron: daily check for matured joins ──────────────────────────────────

  @Cron(CronExpression.EVERY_HOUR)
  async checkMaturedJoins(): Promise<void> {
    const now = new Date().toISOString();
    const snap = await this.firebase
      .collection('group_joins')
      .where('status', '==', 'pending')
      .where('rewardAfter', '<=', now)
      .get();

    this.logger.log(`Checking ${snap.size} matured join(s)`);

    for (const doc of snap.docs) {
      await this.processMatureJoin(doc);
    }
  }

  private async processMatureJoin(doc: FirebaseFirestore.QueryDocumentSnapshot): Promise<void> {
    const join = doc.data();
    const { userId, telegramId, chatId, missionId, rewardAP, daysRequired } = join as {
      userId: string; telegramId: string; chatId: string;
      missionId: string; rewardAP: number; daysRequired: number;
    };

    const stillMember = await this.checkMembership(Number(telegramId), Number(chatId));

    if (!stillMember) {
      await doc.ref.update({ status: 'left', checkedAt: new Date().toISOString() });
      await this.applyBlackScore(userId, BLACK_RULES.leaveWithin7d);
      this.logger.log(`User ${userId} left group before reward — black score applied`);
      return;
    }

    // Check mission still active and has budget
    const missionDoc = await this.firebase.collection('missions').doc(missionId).get();
    if (!missionDoc.exists) {
      await doc.ref.update({ status: 'failed', reason: 'mission_not_found' });
      return;
    }
    const mission = missionDoc.data()!;
    if (mission.status !== 'active') {
      await doc.ref.update({ status: 'failed', reason: 'mission_inactive' });
      return;
    }

    const remaining = (mission.remainingBudget as number) ?? 0;
    if (remaining < rewardAP) {
      await doc.ref.update({ status: 'failed', reason: 'insufficient_budget' });
      return;
    }

    const userData = (await this.firebase.collection('users').doc(userId).get()).data()!;
    const mentorId = userData.mentorId as string | null;
    const platformShare = Math.floor(rewardAP * 0.2);
    const mentorShare = mentorId ? Math.floor(rewardAP * 0.1) : 0;
    const userShare = rewardAP - platformShare - mentorShare;

    await this.points.award(userId, userShare, 'mission_reward',
      `그룹 ${daysRequired}일 유지 보상: ${mission.title as string}`, missionId);
    if (mentorId) {
      await this.points.award(mentorId, mentorShare, 'mentor_bonus',
        `멘토 수당: 그룹 유지`, missionId);
    }

    // Platform vault
    const vaultSnap = await this.firebase.collection('platform_vault').limit(1).get();
    if (!vaultSnap.empty) {
      const current = (vaultSnap.docs[0].data().balance as number) ?? 0;
      await vaultSnap.docs[0].ref.update({ balance: current + platformShare });
    }

    await this.firebase.collection('submissions').add({
      missionId, userId,
      displayName: (userData.firstName as string) || (userData.username as string) || 'User',
      type: 'follow_join',
      telegramId: String(telegramId),
      chatId: String(chatId),
      status: 'approved',
      rewardedAP: userShare,
      daysRetained: daysRequired,
      submittedAt: new Date().toISOString(),
    });

    await missionDoc.ref.update({
      remainingBudget: remaining - rewardAP,
      participantCount: ((mission.participantCount as number) ?? 0) + 1,
    });

    await doc.ref.update({ status: 'rewarded', rewardedAt: new Date().toISOString() });

    // DM notification
    await this.sendRewardDM(Number(telegramId), userShare, mission.title as string, daysRequired);

    // +3 black score for staying 30 days
    if (daysRequired >= 30) {
      await this.applyBlackScore(userId, BLACK_RULES.stay30d);
    }

    this.logger.log(`Rewarded ${userId} with ${userShare} AP for staying ${daysRequired} days`);
  }

  // ── Black score helpers ───────────────────────────────────────────────────

  async applyBlackScore(userId: string, delta: number): Promise<void> {
    const userRef = this.firebase.collection('users').doc(userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return;

    const current = (userDoc.data()!.blackScore as number) ?? 0;
    const newScore = current + delta;
    const blackStatus =
      newScore <= BLACK_THRESHOLDS.black ? 'black'
      : newScore <= BLACK_THRESHOLDS.warning ? 'warning'
      : 'normal';

    await userRef.update({ blackScore: newScore, blackStatus });
    this.logger.log(`Black score: user=${userId} ${current} → ${newScore} (${blackStatus})`);
  }

  async getBlackScore(userId: string): Promise<{ score: number; status: string }> {
    const doc = await this.firebase.collection('users').doc(userId).get();
    if (!doc.exists) return { score: 0, status: 'normal' };
    const data = doc.data()!;
    return {
      score: (data.blackScore as number) ?? 0,
      status: (data.blackStatus as string) ?? 'normal',
    };
  }

  // ── Member check via reward bot ───────────────────────────────────────────

  private async checkMembership(telegramId: number, chatId: number): Promise<boolean> {
    if (!this.rewardBot) return true; // can't verify without bot, optimistically reward
    try {
      const member = await this.rewardBot.telegram.getChatMember(chatId, telegramId);
      return ['member', 'administrator', 'creator'].includes(member.status);
    } catch {
      return false;
    }
  }

  private async sendRewardDM(telegramId: number, ap: number, missionTitle: string, days: number): Promise<void> {
    if (!this.rewardBot) return;
    await this.rewardBot.telegram.sendMessage(
      telegramId,
      `🎉 *그룹 유지 보상!*\n\n✅ 그룹에 *${days}일* 동안 머물러서 *${ap.toLocaleString()} AP*를 획득했습니다!\n📌 미션: ${missionTitle}\n💰 10,000 AP = $1 USD`,
      { parse_mode: 'Markdown' },
    ).catch(() => {});
  }

  // ── Stats for advertiser dashboard ────────────────────────────────────────

  async getMissionRetentionStats(missionId: string): Promise<{
    total: number; rewarded: number; left: number; pending: number;
    retentionRate: number; avgDaysBeforeLeave: number;
  }> {
    const snap = await this.firebase
      .collection('group_joins')
      .where('missionId', '==', missionId)
      .get();

    let rewarded = 0, left = 0, pending = 0, totalLeftDays = 0, leftCount = 0;
    for (const doc of snap.docs) {
      const d = doc.data();
      if (d.status === 'rewarded') rewarded++;
      else if (d.status === 'left') {
        left++;
        if (d.joinedAt && d.leftAt) {
          const days = (new Date(d.leftAt as string).getTime() - new Date(d.joinedAt as string).getTime()) / 86_400_000;
          totalLeftDays += days;
          leftCount++;
        }
      } else pending++;
    }

    const total = snap.size;
    return {
      total,
      rewarded,
      left,
      pending,
      retentionRate: total > 0 ? Math.round((rewarded / total) * 100) : 0,
      avgDaysBeforeLeave: leftCount > 0 ? Math.round(totalLeftDays / leftCount) : 0,
    };
  }
}
