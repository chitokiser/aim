import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';

@Injectable()
export class PointsService {
  constructor(private firebase: FirebaseService) {}

  async award(
    userId: string,
    amount: number,
    type: string,
    description: string,
    missionId?: string,
    postId?: string,
  ) {
    const tx = {
      userId,
      amount,
      type,
      description,
      missionId: missionId ?? null,
      postId: postId ?? null,
      createdAt: new Date().toISOString(),
    };

    await this.firebase.collection('transactions').add(tx);

    const userRef = this.firebase.collection('users').doc(userId);
    const userDoc = await userRef.get();
    const current = userDoc.data()?.points ?? 0;
    await userRef.update({ points: current + amount });

    return tx;
  }

  async deduct(userId: string, amount: number, description: string) {
    return this.award(userId, -amount, 'withdrawal', description);
  }

  async getHistory(userId: string) {
    const snap = await this.firebase
      .collection('transactions')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async awardPost(userId: string, postId: string) {
    const mentorId = (
      await this.firebase.collection('users').doc(userId).get()
    ).data()?.mentorId as string | null;

    const baseReward = 1000;
    const mentorShare = mentorId ? Math.floor(baseReward * 0.1) : 0;
    const userShare = baseReward - Math.floor(baseReward * 0.2) - mentorShare;

    await this.award(userId, userShare, 'post_reward', '게시물 등록 보상', undefined, postId);

    if (mentorId) {
      await this.award(mentorId, mentorShare, 'mentor_bonus', '멘토 수당: 멘티 게시물 등록', undefined, postId);
    }
  }
}
