import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';

@Injectable()
export class UsersService {
  constructor(private firebase: FirebaseService) {}

  async findById(id: string) {
    const doc = await this.firebase.collection('users').doc(id).get();
    if (!doc.exists) throw new NotFoundException('User not found');
    return { id: doc.id, ...doc.data() };
  }

  async findByTelegramId(telegramId: string) {
    const snap = await this.firebase
      .collection('users')
      .where('telegramId', '==', telegramId)
      .get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  async update(id: string, data: Partial<Record<string, unknown>>) {
    await this.firebase.collection('users').doc(id).update(data);
    return this.findById(id);
  }

  async addPoints(userId: string, amount: number): Promise<void> {
    const ref = this.firebase.collection('users').doc(userId);
    await ref.update({
      points: (await ref.get()).data()?.points + amount,
    });
  }

  async getLeaderboard(period: string) {
    const snap = await this.firebase
      .collection('users')
      .orderBy('points', 'desc')
      .limit(100)
      .get();

    return snap.docs.map((doc, i) => ({
      rank: i + 1,
      userId: doc.id,
      username: doc.data().username,
      firstName: doc.data().firstName,
      photoUrl: doc.data().photoUrl ?? null,
      points: doc.data().points,
      postCount: doc.data().postCount ?? 0,
    }));
  }
}
