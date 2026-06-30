import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FieldValue } from 'firebase-admin/firestore';
import { Telegram } from 'telegraf';
import { FirebaseService } from '../firebase/firebase.service';
import { PointsService } from '../points/points.service';
import type { Query } from 'firebase-admin/firestore';

@Injectable()
export class MissionsService {
  constructor(
    private firebase: FirebaseService,
    private points: PointsService,
    private config: ConfigService,
  ) {}

  private async notifySubmission(opts: {
    missionId: string | null;
    displayName: string;
    postUrl?: string;
  }) {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const adminId = this.config.get<string>('ADMIN_TELEGRAM_ID');
    if (!botToken || !adminId) return;

    let missionTitle = '(일반 제출)';
    let advertiserTelegramId: string | null = null;

    if (opts.missionId) {
      try {
        const mDoc = await this.firebase.collection('missions').doc(opts.missionId).get();
        if (mDoc.exists) {
          const mData = mDoc.data() as Record<string, unknown>;
          missionTitle = (mData.title as string) || '미션';
          const advertiserId = mData.advertiserId as string | undefined;
          if (advertiserId) {
            const advDoc = await this.firebase.collection('users').doc(advertiserId).get();
            advertiserTelegramId = (advDoc.data()?.telegramId as string | undefined) ?? null;
          }
        }
      } catch (_) {}
    }

    const msg =
      `📋 *새 미션 증빙 제출*\n\n` +
      `👤 회원: ${opts.displayName}\n` +
      `📌 미션: ${missionTitle}\n` +
      `🔗 제출 URL: ${opts.postUrl || '(링크 없음)'}\n\n` +
      `🔍 [관리자 패널에서 확인](https://ai119.netlify.app/admin)`;

    const telegram = new Telegram(botToken);
    const targets = [adminId];
    if (advertiserTelegramId && advertiserTelegramId !== adminId) targets.push(advertiserTelegramId);
    await Promise.all(targets.map((id) => telegram.sendMessage(id, msg, { parse_mode: 'Markdown' }).catch(() => {})));
  }


  async findAll(status?: string) {
    let query: Query = this.firebase.collection('missions');
    // Default to active-only for public listing; hide templates/pending/rejected unless explicitly requested
    const effectiveStatus = status ?? 'active';
    query = query.where('status', '==', effectiveStatus);
    const snap = await query.get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async findById(id: string) {
    const doc = await this.firebase.collection('missions').doc(id).get();
    if (!doc.exists) throw new NotFoundException('Mission not found');
    return { id: doc.id, ...doc.data() };
  }

  // ── 3-Tier Mission Flow ────────────────────────────────────────────────────

  async createTemplate(adminId: string, dto: Record<string, unknown>) {
    const template = {
      ...dto,
      adminId,
      status: 'template',
      createdAt: new Date().toISOString(),
    };
    const ref = await this.firebase.collection('missions').add(template);
    return { id: ref.id, ...template };
  }

  async findTemplates() {
    const snap = await this.firebase
      .collection('missions')
      .where('status', '==', 'template')
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async requestCampaign(advertiserId: string, templateId: string, dto: Record<string, unknown>) {
    const template = await this.findById(templateId);
    const tData = template as Record<string, unknown>;
    if (tData.status !== 'template') throw new BadRequestException('Not a valid template');

    const totalBudget = (dto.totalBudget ?? dto.budget) as number | undefined;
    let escrowId: string | undefined;

    // Escrow AP upfront so admin approval is never blocked by insufficient AP
    if (totalBudget && totalBudget > 0) {
      const advertiserDoc = await this.firebase.collection('users').doc(advertiserId).get();
      if (!advertiserDoc.exists) throw new NotFoundException('Advertiser not found');
      const currentPoints = (advertiserDoc.data()?.points ?? 0) as number;
      if (currentPoints < totalBudget) throw new BadRequestException('Insufficient AP to create campaign');

      await this.firebase.collection('users').doc(advertiserId).update({
        points: currentPoints - totalBudget,
      });

      const escrowRef = await this.firebase.collection('escrow_wallets').add({
        advertiserId,
        lockedAP: totalBudget,
        createdAt: new Date().toISOString(),
        settled: false,
      });
      escrowId = escrowRef.id;
    }

    const campaign = {
      ...dto,
      templateId,
      missionType: dto.missionType ?? tData.missionType,
      rewardPerUnit: dto.rewardPerUnit ?? tData.rewardPerUnit,
      totalBudget: totalBudget ?? null,
      remainingBudget: totalBudget ?? null,
      advertiserId,
      ...(escrowId ? { escrowId } : {}),
      status: 'pending',
      participantCount: 0,
      createdAt: new Date().toISOString(),
    };
    const ref = await this.firebase.collection('missions').add(campaign);
    return { id: ref.id, ...campaign };
  }

  async approveMission(missionId: string) {
    const mission = await this.findById(missionId);
    const data = mission as Record<string, unknown>;
    if (data.status !== 'pending') throw new BadRequestException('Mission is not pending');

    // AP was already escrowed at campaign creation time via requestCampaign.
    // Admin approval simply activates the mission.
    const totalBudget = (data.totalBudget as number) ?? 0;
    await this.firebase.collection('missions').doc(missionId).update({
      status: 'active',
      remainingBudget: totalBudget > 0 ? totalBudget : null,
      approvedAt: new Date().toISOString(),
    });

    // Update escrow wallet with missionId if it was created without one
    const escrowId = data.escrowId as string | undefined;
    if (escrowId) {
      await this.firebase.collection('escrow_wallets').doc(escrowId).update({ missionId });
    }

    const updated = await this.firebase.collection('missions').doc(missionId).get();
    return { id: missionId, ...updated.data() };
  }

  async rejectMission(missionId: string, reason?: string) {
    const mission = await this.findById(missionId);
    const data = mission as Record<string, unknown>;
    if (data.status !== 'pending') throw new BadRequestException('Mission is not pending');

    // AP is NOT refunded on rejection — once deducted it is held until budget is consumed.
    // Mark escrow as settled (without refund) so it is not processed again.
    const escrowId = data.escrowId as string | undefined;
    if (escrowId) {
      const escrowDoc = await this.firebase.collection('escrow_wallets').doc(escrowId).get();
      if (escrowDoc.exists && !escrowDoc.data()?.settled) {
        await this.firebase.collection('escrow_wallets').doc(escrowId).update({
          settled: true,
          refunded: false,
          settledAt: new Date().toISOString(),
        });
      }
    }

    await this.firebase.collection('missions').doc(missionId).update({
      status: 'rejected',
      rejectionReason: reason ?? '',
      rejectedAt: new Date().toISOString(),
    });
    return { id: missionId, status: 'rejected' };
  }

  // Auto-award AP when user joins a Telegram group linked to an active follow_join mission
  async awardFollowJoin(telegramId: string, chatId: string | number) {
    const userSnap = await this.firebase
      .collection('users')
      .where('telegramId', '==', String(telegramId))
      .limit(1)
      .get();
    if (userSnap.empty) return null;

    const userDoc = userSnap.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data();

    const missionsSnap = await this.firebase
      .collection('missions')
      .where('status', '==', 'active')
      .where('missionType', '==', 'follow_join')
      .where('targetGroupId', '==', String(chatId))
      .get();

    if (missionsSnap.empty) return null;

    const results: { missionId: string; userId: string; reward: number }[] = [];

    for (const missionDoc of missionsSnap.docs) {
      const missionId = missionDoc.id;
      const mission = missionDoc.data();

      const existing = await this.firebase
        .collection('submissions')
        .where('missionId', '==', missionId)
        .where('userId', '==', userId)
        .limit(1)
        .get();
      if (!existing.empty) continue;

      const remainingBudget = (mission.remainingBudget as number) ?? 0;
      const reward = (mission.rewardPerUnit as number) ?? (mission.reward as number) ?? 1000;
      if (remainingBudget < reward) continue;

      const maxParticipants = mission.maxParticipants as number | undefined;
      const participantCount = (mission.participantCount as number) ?? 0;
      if (maxParticipants && participantCount >= maxParticipants) continue;

      const mentorId = userData.mentorId as string | null;
      const platformShare = Math.floor(reward * 0.2);
      const mentorShare = mentorId ? Math.floor(reward * 0.1) : 0;
      const userShare = reward - platformShare - mentorShare;

      await this.points.award(userId, userShare, 'mission_reward', `그룹 가입 보상: ${mission.title as string}`, missionId);
      if (mentorId) {
        await this.points.award(mentorId, mentorShare, 'mentor_bonus', `멘토 수당: 그룹 가입`, missionId);
      }
      await this.creditPlatformVault(platformShare, missionId, mission.title as string);

      await this.firebase.collection('submissions').add({
        missionId,
        userId,
        displayName: (userData.firstName as string) || (userData.username as string) || 'User',
        type: 'follow_join',
        telegramId: String(telegramId),
        chatId: String(chatId),
        status: 'approved',
        rewardedAP: userShare,
        submittedAt: new Date().toISOString(),
      });

      const newRemainingBudget = remainingBudget - reward;
      await this.firebase.collection('missions').doc(missionId).update({
        remainingBudget: FieldValue.increment(-reward),
        participantCount: FieldValue.increment(1),
        ...(newRemainingBudget <= 0 ? { status: 'ended', endedAt: new Date().toISOString() } : {}),
      });

      results.push({ missionId, userId, reward: userShare });
    }

    return results;
  }

  // ── End 3-Tier Mission Flow ────────────────────────────────────────────────

  async getMyJoinedMissionIds(userId: string) {
    const snap = await this.firebase
      .collection('submissions')
      .where('userId', '==', userId)
      .get();
    const ids = [...new Set(snap.docs.map((d) => d.data().missionId as string).filter(Boolean))];
    return { missionIds: ids };
  }

  async getMySubmission(missionId: string, userId: string) {
    const snap = await this.firebase
      .collection('submissions')
      .where('missionId', '==', missionId)
      .where('userId', '==', userId)
      .limit(1)
      .get();
    if (snap.empty) return { hasSubmitted: false };
    const doc = snap.docs[0];
    return { hasSubmitted: true, submission: { id: doc.id, ...doc.data() } };
  }

  async submitGeneral(
    userId: string,
    dto: { postUrl: string; section: string; platform: string; description: string; missionId?: string },
  ) {
    if (dto.missionId) {
      const existing = await this.firebase
        .collection('submissions')
        .where('missionId', '==', dto.missionId)
        .where('userId', '==', userId)
        .limit(1)
        .get();
      if (!existing.empty) throw new BadRequestException('Already submitted');
    }

    const userDoc = await this.firebase.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const displayName =
      (userData?.firstName as string | null) ||
      (userData?.username as string | null) ||
      'User';

    const sub = {
      userId,
      displayName,
      postUrl: dto.postUrl,
      section: dto.section,
      platform: dto.platform,
      description: dto.description,
      missionId: dto.missionId || null,
      // pending when tied to an advertiser mission so they can review; else approved for public wall
      status: dto.missionId ? 'pending' : 'approved',
      likes: 0,
      createdAt: new Date().toISOString(),
    };
    const ref = await this.firebase.collection('submissions').add(sub);
    await this.firebase.collection('users').doc(userId).update({
      missionsCompleted: FieldValue.increment(1),
    });
    this.notifySubmission({ missionId: dto.missionId ?? null, displayName, postUrl: dto.postUrl }).catch(() => {});
    return { id: ref.id, ...sub };
  }

  // ── Advertiser: list their own active/pending missions ─────────────────────

  async findByAdvertiser(advertiserId: string) {
    const snap = await this.firebase
      .collection('missions')
      .where('advertiserId', '==', advertiserId)
      .get();
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    docs.sort((a, b) => {
      const aTime = ((a as Record<string, unknown>).createdAt as string) ?? '';
      const bTime = ((b as Record<string, unknown>).createdAt as string) ?? '';
      return bTime.localeCompare(aTime);
    });

    if (docs.length === 0) return docs;

    // Batch-fetch submission counts for all missions
    const missionIds = docs.map((d) => (d as Record<string, unknown>).id as string);
    const subCounts: Record<string, { total: number; pending: number }> = {};
    missionIds.forEach((id) => { subCounts[id] = { total: 0, pending: 0 }; });

    const subSnap = await this.firebase
      .collection('submissions')
      .where('missionId', 'in', missionIds.slice(0, 30))
      .get();
    subSnap.docs.forEach((d) => {
      const data = d.data();
      const mid = data.missionId as string;
      if (subCounts[mid]) {
        subCounts[mid].total += 1;
        if (data.status === 'pending') subCounts[mid].pending += 1;
      }
    });

    return docs.map((d) => {
      const rec = d as Record<string, unknown>;
      const counts = subCounts[rec.id as string] ?? { total: 0, pending: 0 };
      return { ...rec, totalSubmissionCount: counts.total, pendingSubmissionCount: counts.pending };
    });
  }

  // ── Advertiser: list pending submissions for one of their missions ─────────

  async getPendingSubmissions(missionId: string, advertiserId: string) {
    const mission = await this.findById(missionId);
    const mData = mission as Record<string, unknown>;
    if (mData.advertiserId !== advertiserId) throw new BadRequestException('Not your mission');

    const snap = await this.firebase
      .collection('submissions')
      .where('missionId', '==', missionId)
      .where('status', '==', 'pending')
      .get();
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return docs.sort((a, b) => {
      const aTime = ((a as Record<string, unknown>).createdAt as string) ?? '';
      const bTime = ((b as Record<string, unknown>).createdAt as string) ?? '';
      return aTime.localeCompare(bTime);
    });
  }

  // ── User: list own submissions across all missions ────────────────────────────

  async getMySubmissions(userId: string) {
    const snap = await this.firebase
      .collection('submissions')
      .where('userId', '==', userId)
      .get();
    const submissions = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const aTime = ((a as Record<string, unknown>).createdAt as string) ?? '';
        const bTime = ((b as Record<string, unknown>).createdAt as string) ?? '';
        return bTime.localeCompare(aTime);
      });
    const missionIds = [...new Set(submissions.map((s) => (s as Record<string, unknown>).missionId as string).filter(Boolean))];
    const missionTitles: Record<string, string> = {};
    await Promise.all(
      missionIds.map(async (mid) => {
        const doc = await this.firebase.collection('missions').doc(mid).get();
        if (doc.exists) missionTitles[mid] = (doc.data()?.title as string) || mid;
      }),
    );
    return submissions.map((s) => {
      const rec = s as Record<string, unknown>;
      return { ...rec, missionTitle: rec.missionId ? (missionTitles[rec.missionId as string] ?? null) : null };
    });
  }

  // ── Admin: list all pending submissions across all missions ─────────────────

  async getAllPendingSubmissions() {
    const snap = await this.firebase
      .collection('submissions')
      .where('status', '==', 'pending')
      .get();
    const submissions = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => {
      const aTime = ((a as Record<string, unknown>).createdAt as string) ?? '';
      const bTime = ((b as Record<string, unknown>).createdAt as string) ?? '';
      return aTime.localeCompare(bTime);
    });

    // Enrich with mission title for display
    const missionIds = [...new Set(submissions.map((s) => (s as Record<string, unknown>).missionId as string).filter(Boolean))];
    const missionTitles: Record<string, string> = {};
    await Promise.all(
      missionIds.map(async (mid) => {
        const doc = await this.firebase.collection('missions').doc(mid).get();
        if (doc.exists) {
          missionTitles[mid] = (doc.data()?.title as string) || mid;
        }
      }),
    );

    return submissions.map((s) => {
      const rec = s as Record<string, unknown>;
      return {
        ...rec,
        missionTitle: rec.missionId ? (missionTitles[rec.missionId as string] ?? null) : null,
      };
    });
  }

  // ── Admin: approve submission (bypasses advertiser ownership check) ──────────

  async adminApproveSubmission(submissionId: string) {
    const subRef = this.firebase.collection('submissions').doc(submissionId);
    const subDoc = await subRef.get();
    if (!subDoc.exists) throw new NotFoundException('Submission not found');

    const sub = subDoc.data() as Record<string, unknown>;
    if (sub.status !== 'pending') throw new BadRequestException('Submission is not pending');

    const missionId = sub.missionId as string;
    const missionRef = this.firebase.collection('missions').doc(missionId);
    const missionDoc = await missionRef.get();
    if (!missionDoc.exists) throw new NotFoundException('Mission not found');

    const mission = missionDoc.data() as Record<string, unknown>;
    const rewardPerUnit = (mission.rewardPerUnit ?? mission.reward ?? 0) as number;
    const remainingBudget = (mission.remainingBudget ?? 0) as number;
    if (remainingBudget < rewardPerUnit) throw new BadRequestException('Insufficient mission budget');

    const userId = sub.userId as string;
    const userDoc = await this.firebase.collection('users').doc(userId).get();
    const mentorId = (userDoc.data()?.mentorId ?? null) as string | null;

    const userShare = Math.floor(rewardPerUnit * 0.7);
    const mentorShare = Math.floor(rewardPerUnit * 0.1);
    const platformShare = rewardPerUnit - userShare - mentorShare;

    await this.points.award(userId, userShare, 'mission_reward', `미션 보상: ${mission.title as string}`, missionId);

    if (mentorId) {
      await this.points.award(mentorId, mentorShare, 'mentor_bonus', `멘토 수당: ${mission.title as string}`, missionId);
    } else {
      await this.firebase.collection('platform_vault').add({
        amount: mentorShare,
        reason: 'no_mentor_bonus',
        missionId,
        createdAt: new Date().toISOString(),
      });
    }

    await this.firebase.collection('platform_vault').add({
      amount: platformShare,
      reason: 'platform_fee',
      missionId,
      createdAt: new Date().toISOString(),
    });

    await missionRef.update({
      remainingBudget: FieldValue.increment(-rewardPerUnit),
      participantCount: FieldValue.increment(1),
      ...(remainingBudget - rewardPerUnit <= 0 ? { status: 'ended', endedAt: new Date().toISOString() } : {}),
    });

    await subRef.update({ status: 'approved', approvedAt: new Date().toISOString() });
    return { approved: true, rewardedAP: userShare };
  }

  // ── Admin: reject submission (bypasses advertiser ownership check) ───────────

  async adminRejectSubmission(submissionId: string) {
    const subRef = this.firebase.collection('submissions').doc(submissionId);
    const subDoc = await subRef.get();
    if (!subDoc.exists) throw new NotFoundException('Submission not found');

    const sub = subDoc.data() as Record<string, unknown>;
    if (sub.status !== 'pending') throw new BadRequestException('Submission is not pending');

    await subRef.update({ status: 'rejected', rejectedAt: new Date().toISOString() });
    return { rejected: true };
  }

  // ── Advertiser: approve a submission → award AP ───────────────────────────

  async approveSubmission(submissionId: string, advertiserId: string) {
    const subRef = this.firebase.collection('submissions').doc(submissionId);
    const subDoc = await subRef.get();
    if (!subDoc.exists) throw new NotFoundException('Submission not found');

    const sub = subDoc.data() as Record<string, unknown>;
    if (sub.status !== 'pending') throw new BadRequestException('Submission is not pending');

    const missionId = sub.missionId as string;
    const missionRef = this.firebase.collection('missions').doc(missionId);
    const missionDoc = await missionRef.get();
    if (!missionDoc.exists) throw new NotFoundException('Mission not found');

    const mission = missionDoc.data() as Record<string, unknown>;
    if (mission.advertiserId !== advertiserId) throw new BadRequestException('Not your mission');

    const rewardPerUnit = (mission.rewardPerUnit ?? mission.reward ?? 0) as number;
    const remainingBudget = (mission.remainingBudget ?? 0) as number;
    if (remainingBudget < rewardPerUnit) throw new BadRequestException('Insufficient mission budget');

    const userId = sub.userId as string;
    const userDoc = await this.firebase.collection('users').doc(userId).get();
    const mentorId = (userDoc.data()?.mentorId ?? null) as string | null;

    const userShare = Math.floor(rewardPerUnit * 0.7);
    const mentorShare = Math.floor(rewardPerUnit * 0.1);
    const platformShare = rewardPerUnit - userShare - mentorShare;

    await this.points.award(userId, userShare, 'mission_reward', `미션 보상: ${mission.title as string}`, missionId);

    if (mentorId) {
      await this.points.award(mentorId, mentorShare, 'mentor_bonus', `멘토 수당: ${mission.title as string}`, missionId);
    } else {
      // no mentor → platform keeps it
      await this.firebase.collection('platform_vault').add({
        amount: mentorShare,
        reason: 'no_mentor_bonus',
        missionId,
        createdAt: new Date().toISOString(),
      });
    }

    await this.firebase.collection('platform_vault').add({
      amount: platformShare,
      reason: 'platform_fee',
      missionId,
      createdAt: new Date().toISOString(),
    });

    const newRemainingBudget = remainingBudget - rewardPerUnit;
    await missionRef.update({
      remainingBudget: FieldValue.increment(-rewardPerUnit),
      participantCount: FieldValue.increment(1),
      ...(newRemainingBudget <= 0 ? { status: 'ended', endedAt: new Date().toISOString() } : {}),
    });

    await subRef.update({ status: 'approved', approvedAt: new Date().toISOString() });

    return { approved: true, rewardedAP: userShare };
  }

  // ── Advertiser: reject a submission ───────────────────────────────────────

  async rejectSubmission(submissionId: string, advertiserId: string) {
    const subRef = this.firebase.collection('submissions').doc(submissionId);
    const subDoc = await subRef.get();
    if (!subDoc.exists) throw new NotFoundException('Submission not found');

    const sub = subDoc.data() as Record<string, unknown>;
    if (sub.status !== 'pending') throw new BadRequestException('Submission is not pending');

    const missionDoc = await this.firebase.collection('missions').doc(sub.missionId as string).get();
    if (!missionDoc.exists) throw new NotFoundException('Mission not found');
    if ((missionDoc.data() as Record<string, unknown>).advertiserId !== advertiserId) {
      throw new BadRequestException('Not your mission');
    }

    await subRef.update({ status: 'rejected', rejectedAt: new Date().toISOString() });
    return { rejected: true };
  }

  async update(id: string, dto: Record<string, unknown>) {
    const ref = this.firebase.collection('missions').doc(id);
    const doc = await ref.get();
    if (!doc.exists) throw new NotFoundException('Mission not found');
    const { id: _id, ...fields } = dto;
    await ref.update({ ...fields, updatedAt: new Date().toISOString() });
    const updated = await ref.get();
    return { id, ...updated.data() };
  }

  async remove(id: string) {
    const ref = this.firebase.collection('missions').doc(id);
    const doc = await ref.get();
    if (!doc.exists) throw new NotFoundException('Mission not found');
    await ref.delete();
  }

  // ── Legacy create (no escrow) ──────────────────────────────────────────────

  async create(advertiserId: string, dto: Record<string, unknown>) {
    const mission = {
      ...dto,
      advertiserId,
      status: 'pending',
      participantCount: 0,
      createdAt: new Date().toISOString(),
    };
    const ref = await this.firebase.collection('missions').add(mission);
    return { id: ref.id, ...mission };
  }

  // ── New: create with AP escrow ─────────────────────────────────────────────

  async createWithEscrow(advertiserId: string, dto: Record<string, unknown>) {
    const totalBudget = dto.totalBudget as number;
    if (!totalBudget || totalBudget <= 0) throw new BadRequestException('totalBudget required');

    // Deduct AP from advertiser wallet
    const advertiserDoc = await this.firebase.collection('users').doc(advertiserId).get();
    if (!advertiserDoc.exists) throw new NotFoundException('Advertiser not found');
    const advertiserPoints = (advertiserDoc.data()?.points ?? 0) as number;
    if (advertiserPoints < totalBudget) throw new BadRequestException('Insufficient AP balance');

    await this.firebase.collection('users').doc(advertiserId).update({
      points: advertiserPoints - totalBudget,
    });

    // Lock into escrow
    const escrowRef = await this.firebase.collection('escrow_wallets').add({
      advertiserId,
      lockedAP: totalBudget,
      createdAt: new Date().toISOString(),
      settled: false,
    });

    const mission = {
      ...dto,
      advertiserId,
      escrowId: escrowRef.id,
      status: 'active',
      participantCount: 0,
      remainingBudget: totalBudget,
      createdAt: new Date().toISOString(),
    };
    const ref = await this.firebase.collection('missions').add(mission);
    return { id: ref.id, ...mission };
  }

  // ── New: multi-link submission (auto-approved; like voting starts) ─────────

  async submitLinks(
    missionId: string,
    userId: string,
    links: { youtube?: string; blog?: string; comment?: string; screenshot?: string },
  ) {
    const mission = await this.findById(missionId);
    const data = mission as Record<string, unknown>;

    if (data.status !== 'active') throw new BadRequestException('Mission is not active');

    // Prevent duplicate submission per user per mission
    const existing = await this.firebase
      .collection('submissions')
      .where('missionId', '==', missionId)
      .where('userId', '==', userId)
      .limit(1)
      .get();
    if (!existing.empty) throw new BadRequestException('Already submitted');

    const userDoc = await this.firebase.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const displayName =
      (userData?.firstName as string | null) ||
      (userData?.username as string | null) ||
      'User';

    const submission = {
      missionId,
      userId,
      displayName,
      links,
      status: 'approved',
      likes: 0,
      submittedAt: new Date().toISOString(),
    };

    const ref = await this.firebase.collection('submissions').add(submission);

    await Promise.all([
      this.firebase.collection('missions').doc(missionId).update({
        participantCount: FieldValue.increment(1),
      }),
      this.firebase.collection('users').doc(userId).update({
        missionsCompleted: FieldValue.increment(1),
      }),
    ]);

    const firstLink = links.youtube || links.blog || links.comment || links.screenshot;
    this.notifySubmission({ missionId, displayName, postUrl: firstLink }).catch(() => {});

    return { id: ref.id, ...submission };
  }

  // ── New: like/unlike a submission (FieldValue.increment prevents race condition) ──

  async likeSubmission(submissionId: string, userId: string) {
    const subRef = this.firebase.collection('submissions').doc(submissionId);
    const subDoc = await subRef.get();
    if (!subDoc.exists) throw new NotFoundException('Submission not found');

    const likeKey = `${submissionId}_${userId}`;
    const likeDoc = await this.firebase.collection('submission_likes').doc(likeKey).get();
    const alreadyLiked = likeDoc.exists;
    const currentLikes = (subDoc.data()?.likes ?? 0) as number;

    if (alreadyLiked) {
      await this.firebase.collection('submission_likes').doc(likeKey).delete();
      await subRef.update({ likes: FieldValue.increment(-1) });
      return { liked: false, likes: Math.max(0, currentLikes - 1) };
    } else {
      await this.firebase.collection('submission_likes').doc(likeKey).set({
        userId,
        submissionId,
        likedAt: new Date().toISOString(),
      });
      await subRef.update({ likes: FieldValue.increment(1) });
      return { liked: true, likes: currentLikes + 1 };
    }
  }

  // ── New: get submissions for a mission (sorted by likes) ──────────────────

  async getSubmissions(missionId: string) {
    const snap = await this.firebase
      .collection('submissions')
      .where('missionId', '==', missionId)
      .orderBy('likes', 'desc')
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  // ── New: settle a mission (like-proportional AP distribution) ────────────
  //
  // Budget split: 70% → creators (proportional to likes), 10% → mentors,
  //               20% → platform vault
  // If no votes cast → full refund to advertiser.

  async settleMission(missionId: string) {
    const mission = await this.findById(missionId);
    const data = mission as Record<string, unknown>;

    if (data.status !== 'active') return { skipped: true, reason: 'not active' };

    const totalBudget = data.totalBudget as number;
    const submissions = await this.getSubmissions(missionId);
    const totalLikes = submissions.reduce(
      (s, sub) => s + (((sub as Record<string, unknown>).likes as number) ?? 0),
      0,
    );

    // Budget is non-refundable — just end the mission if nobody submitted or voted
    if (submissions.length === 0 || totalLikes === 0) {
      if (data.escrowId) {
        await this.firebase
          .collection('escrow_wallets')
          .doc(data.escrowId as string)
          .update({ settled: true, settledAt: new Date().toISOString() });
      }
      await this.firebase
        .collection('missions')
        .doc(missionId)
        .update({ status: 'ended', settledAt: new Date().toISOString() });
      return {
        settled: false,
        refunded: false,
        reason: submissions.length === 0 ? 'no_submissions' : 'no_votes',
      };
    }

    // Platform vault: 20% of total budget
    const platformShare = Math.floor(totalBudget * 0.2);
    await this.creditPlatformVault(platformShare, missionId, data.title as string);

    // Member pool: 70% distributed proportionally by likes
    const memberPool = Math.floor(totalBudget * 0.7);
    const distributions: { userId: string; ap: number }[] = [];

    for (const sub of submissions) {
      const s = sub as Record<string, unknown>;
      const likes = (s.likes as number) ?? 0;
      if (likes <= 0) continue;
      const userId = s.userId as string;
      const share = Math.floor((likes / totalLikes) * memberPool);
      if (share <= 0) continue;

      const mentorId = (await this.firebase.collection('users').doc(userId).get()).data()
        ?.mentorId as string | null;
      const mentorShare = Math.floor(totalBudget * 0.1 * (likes / totalLikes));

      await this.points.award(
        userId,
        share,
        'mission_settlement',
        `미션 정산: ${data.title as string}`,
        missionId,
        sub.id,
      );
      if (mentorId) {
        await this.points.award(
          mentorId,
          mentorShare,
          'mentor_settlement',
          `멘토 정산: 미션 ${missionId}`,
          missionId,
          sub.id,
        );
      }
      distributions.push({ userId, ap: share });
    }

    // Release escrow
    if (data.escrowId) {
      await this.firebase
        .collection('escrow_wallets')
        .doc(data.escrowId as string)
        .update({ settled: true, settledAt: new Date().toISOString() });
    }

    await this.firebase
      .collection('missions')
      .doc(missionId)
      .update({ status: 'settled', settledAt: new Date().toISOString() });

    await this.firebase.collection('settlements').add({
      missionId,
      totalBudget,
      platformShare,
      memberPool,
      totalLikes,
      distributions,
      settledAt: new Date().toISOString(),
    });

    return { settled: true, platformShare, totalLikes, distributions };
  }

  // ── Platform vault ─────────────────────────────────────────────────────────

  private async creditPlatformVault(amount: number, missionId: string, missionTitle: string) {
    await this.firebase.collection('platform_vault').add({
      amount,
      missionId,
      source: 'mission_settlement',
      description: `미션 정산 수수료: ${missionTitle}`,
      createdAt: new Date().toISOString(),
    });
    // Running total stored in a single summary document
    await this.firebase
      .collection('platform_vault')
      .doc('__total__')
      .set({ totalAP: FieldValue.increment(amount) }, { merge: true });
  }

  async getPlatformVaultBalance() {
    const totalDoc = await this.firebase.collection('platform_vault').doc('__total__').get();
    const totalAP = (totalDoc.data()?.totalAP ?? 0) as number;
    // Transactions are ordered by createdAt; __total__ has no createdAt so it is excluded
    const snap = await this.firebase
      .collection('platform_vault')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    const transactions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { totalAP, transactions };
  }

  // ── Legacy submit (kept for backwards compat) ──────────────────────────────

  async submitPost(missionId: string, userId: string, postUrl: string, tags: string[]) {
    const mission = await this.findById(missionId);
    const data = mission as Record<string, unknown>;

    const requiredTags = (data.requiredTags as string[]) ?? [];
    const missingTags = requiredTags.filter((t) => !tags.includes(t));
    if (missingTags.length > 0) {
      throw new BadRequestException(`Missing required tags: ${missingTags.join(', ')}`);
    }

    if ((data.remainingBudget as number) < (data.reward as number)) {
      throw new BadRequestException('Mission budget exhausted');
    }

    const post = {
      userId,
      missionId,
      platform: this.detectPlatform(postUrl),
      postUrl,
      tags,
      status: 'pending',
      points: 0,
      likes: 0,
      comments: 0,
      createdAt: new Date().toISOString(),
    };

    const postRef = await this.firebase.collection('posts').add(post);
    await this.verifyAndAwardPost(postRef.id, missionId, userId, data);
    return { id: postRef.id, ...post };
  }

  private async verifyAndAwardPost(
    postId: string,
    missionId: string,
    userId: string,
    mission: Record<string, unknown>,
  ) {
    const reward = mission.reward as number;
    const mentorId = (await this.firebase.collection('users').doc(userId).get()).data()
      ?.mentorId as string | null;

    const platformShare = Math.floor(reward * 0.2);
    const mentorShare = Math.floor(reward * 0.1);
    const userShare = reward - platformShare - (mentorId ? mentorShare : 0);

    await this.firebase.collection('posts').doc(postId).update({
      status: 'approved',
      points: userShare,
      verifiedAt: new Date().toISOString(),
    });

    await this.points.award(userId, userShare, 'mission_reward', `미션 보상: ${mission.title}`, missionId, postId);

    if (mentorId) {
      await this.points.award(mentorId, mentorShare, 'mentor_bonus', `멘토 수당: 멘티 미션 완료`, missionId, postId);
    }

    await this.firebase.collection('missions').doc(missionId).update({
      remainingBudget: FieldValue.increment(-reward),
      participantCount: FieldValue.increment(1),
    });

    // Credit platform share to vault for legacy per-post missions too
    await this.creditPlatformVault(platformShare, missionId, mission.title as string);
  }

  private detectPlatform(url: string): string {
    if (url.includes('instagram')) return 'Instagram';
    if (url.includes('youtube') || url.includes('youtu.be')) return 'YouTube';
    if (url.includes('tiktok')) return 'TikTok';
    if (url.includes('twitter') || url.includes('x.com')) return 'X';
    if (url.includes('facebook')) return 'Facebook';
    if (url.includes('telegram')) return 'Telegram';
    if (url.includes('reddit')) return 'Reddit';
    return 'Blog';
  }
}
