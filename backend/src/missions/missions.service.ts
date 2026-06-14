import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
