import { BadRequestException, Injectable } from '@nestjs/common';
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
    const userSnap = await this.firebase.collection('users').doc(userId).get();
    const current = (userSnap.data()?.points as number) ?? 0;
    if (current < amount) {
      throw new BadRequestException(`Insufficient AP. Required: ${amount}, balance: ${current}`);
    }
    return this.award(userId, -amount, 'withdrawal', description);
  }

  async getHistory(userId: string) {
    const snap = await this.firebase
      .collection('transactions')
      .where('userId', '==', userId)
      .get();
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return docs
      .sort((a, b) => {
        const aT = ((a as Record<string, unknown>).createdAt as string) ?? '';
        const bT = ((b as Record<string, unknown>).createdAt as string) ?? '';
        return bT.localeCompare(aT);
      })
      .slice(0, 100);
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
