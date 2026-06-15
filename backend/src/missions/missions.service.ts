import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FieldValue } from 'firebase-admin/firestore';
import { FirebaseService } from '../firebase/firebase.service';
import { PointsService } from '../points/points.service';
import type { Query } from 'firebase-admin/firestore';

@Injectable()
export class MissionsService {
  constructor(
    private firebase: FirebaseService,
    private points: PointsService,
  ) {}

  async findAll(status?: string) {
    let query: Query = this.firebase.collection('missions');
    if (status) query = query.where('status', '==', status);
    const snap = await query.get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async findById(id: string) {
    const doc = await this.firebase.collection('missions').doc(id).get();
    if (!doc.exists) throw new NotFoundException('Mission not found');
    return { id: doc.id, ...doc.data() };
  }

  async submitGeneral(
    userId: string,
    dto: { postUrl: string; section: string; platform: string; description: string; missionId?: string },
  ) {
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
      status: 'approved',
      likes: 0,
      createdAt: new Date().toISOString(),
    };
    const ref = await this.firebase.collection('submissions').add(sub);
    return { id: ref.id, ...sub };
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

    await this.firebase.collection('missions').doc(missionId).update({
      participantCount: ((data.participantCount as number) ?? 0) + 1,
    });

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

    // Refund advertiser if nobody submitted or nobody voted
    if (submissions.length === 0 || totalLikes === 0) {
      const advertiserId = data.advertiserId as string;
      if (advertiserId && totalBudget > 0) {
        await this.points.award(
          advertiserId,
          totalBudget,
          'mission_refund',
          `미션 환불: ${data.title as string}`,
          missionId,
        );
      }
      if (data.escrowId) {
        await this.firebase
          .collection('escrow_wallets')
          .doc(data.escrowId as string)
          .update({ settled: true, refunded: true, settledAt: new Date().toISOString() });
      }
      await this.firebase
        .collection('missions')
        .doc(missionId)
        .update({ status: 'refunded', settledAt: new Date().toISOString() });
      return {
        settled: false,
        refunded: true,
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
      remainingBudget: (mission.remainingBudget as number) - reward,
      participantCount: (mission.participantCount as number) + 1,
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
