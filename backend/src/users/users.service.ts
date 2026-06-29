import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';

function generateReferralCode(telegramId: string): string {
  const base = parseInt(telegramId, 10) % 1000000;
  return `AI119${base.toString().padStart(6, '0')}`;
}

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

  async findByTronWallet(address: string): Promise<Record<string, unknown> | null> {
    const snap = await this.firebase
      .collection('users')
      .where('tronWallet', '==', address)
      .limit(1)
      .get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...(doc.data() as Record<string, unknown>) };
  }

  async findMentees(mentorId: string) {
    const snap = await this.firebase
      .collection('users')
      .where('mentorId', '==', mentorId)
      .get();
    return snap.docs.map((doc) => {
      const d = doc.data() as Record<string, unknown>;
      return {
        id: doc.id,
        firstName: d.firstName ?? '',
        lastName: d.lastName ?? '',
        username: d.username ?? '',
        photoUrl: d.photoUrl ?? null,
        points: d.points ?? 0,
        joinedAt: d.createdAt ?? null,
      };
    });
  }

  async findByReferralCode(code: string) {
    const snap = await this.firebase
      .collection('users')
      .where('referralCode', '==', code)
      .limit(1)
      .get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  private async findAdminUser(): Promise<{ id: string } & Record<string, unknown> | null> {
    const snap = await this.firebase
      .collection('users')
      .where('role', '==', 'admin')
      .limit(1)
      .get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() } as { id: string } & Record<string, unknown>;
  }

  async registerFromTelegram(params: {
    telegramId: string;
    firstName: string;
    lastName?: string;
    username?: string;
    refCode?: string;
  }): Promise<{ user: Record<string, unknown>; isNew: boolean }> {
    const existing = await this.findByTelegramId(params.telegramId);
    if (existing) return { user: existing, isNew: false };

    // Resolve mentor — referral code takes priority, else admin fallback
    let mentor: ({ id: string } & Record<string, unknown>) | null = null;
    if (params.refCode) {
      mentor = (await this.findByReferralCode(params.refCode)) as typeof mentor;
    }
    if (!mentor) {
      mentor = await this.findAdminUser();
    }

    const referralCode = generateReferralCode(params.telegramId);
    const now = new Date().toISOString();

    const newUser = {
      telegramId: params.telegramId,
      firstName: params.firstName,
      lastName: params.lastName ?? '',
      username: params.username ?? '',
      referralCode,
      mentorId: mentor?.id ?? null,
      points: 0,
      freePoints: 10000,
      postCount: 0,
      role: 'member',
      createdAt: now,
    };

    const ref = await this.firebase.collection('users').add(newUser);

    // AP bonus to mentor for the referral
    if (mentor?.id) {
      await this.addPoints(mentor.id as string, 1000);
    }

    return { user: { id: ref.id, ...newUser }, isNew: true };
  }

  async addPoints(userId: string, amount: number): Promise<void> {
    const ref = this.firebase.collection('users').doc(userId);
    await ref.update({
      points: (await ref.get()).data()?.points + amount,
    });
  }

  async deductPoints(userId: string, amount: number): Promise<void> {
    const ref = this.firebase.collection('users').doc(userId);
    const current = ((await ref.get()).data()?.points as number) ?? 0;
    if (current < amount) throw new Error('Insufficient AP');
    await ref.update({ points: current - amount });
  }

  async deductFreePoints(userId: string, amount: number): Promise<void> {
    const ref = this.firebase.collection('users').doc(userId);
    const current = ((await ref.get()).data()?.freePoints as number) ?? 0;
    if (current < amount) throw new Error('Insufficient P');
    await ref.update({ freePoints: current - amount });
  }

  async addFreePoints(userId: string, amount: number): Promise<void> {
    const ref = this.firebase.collection('users').doc(userId);
    const current = ((await ref.get()).data()?.freePoints as number) ?? 0;
    await ref.update({ freePoints: current + amount });
  }

  async findAll(search?: string): Promise<Array<Record<string, unknown>>> {
    const snap = await this.firebase.collection('users').orderBy('createdAt', 'desc').limit(500).get();
    const all = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Record<string, unknown>));
    if (!search) return all;
    const q = search.toLowerCase();
    return all.filter(
      (u) =>
        String(u.username ?? '').toLowerCase().includes(q) ||
        String(u.firstName ?? '').toLowerCase().includes(q) ||
        String(u.telegramId ?? '').includes(q),
    );
  }

  async isAdminUser(userId: string): Promise<boolean> {
    try {
      const doc = await this.firebase.collection('users').doc(userId).get();
      return doc.data()?.isAdmin === true;
    } catch {
      return false;
    }
  }

  async getTelegramSettings(): Promise<Record<string, string>> {
    const doc = await this.firebase.collection('admin_settings').doc('telegram').get();
    return (doc.data() ?? {}) as Record<string, string>;
  }

  async saveTelegramSettings(settings: Record<string, string>): Promise<Record<string, string>> {
    await this.firebase
      .collection('admin_settings')
      .doc('telegram')
      .set(settings, { merge: true });
    return settings;
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
