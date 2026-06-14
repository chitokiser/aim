import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { FirebaseService } from '../firebase/firebase.service';
import type { DocumentData } from 'firebase-admin/firestore';

@Injectable()
export class AuthService {
  constructor(
    private config: ConfigService,
    private jwt: JwtService,
    private firebase: FirebaseService,
  ) {}

  verifyTelegramAuth(data: Record<string, string>): boolean {
    const { hash, ...rest } = data;
    if (!hash) return false;

    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
    const secretKey = crypto.createHash('sha256').update(botToken).digest();
    const checkString = Object.keys(rest)
      .sort()
      .map((k) => `${k}=${rest[k]}`)
      .join('\n');
    const computedHash = crypto
      .createHmac('sha256', secretKey)
      .update(checkString)
      .digest('hex');

    const authDate = parseInt(rest.auth_date ?? '0', 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) return false;

    return computedHash === hash;
  }

  async loginOrRegister(telegramData: Record<string, string>) {
    const telegramId = telegramData.id;
    const refCode = telegramData.ref;

    const usersRef = this.firebase.collection('users');
    const existing = await usersRef.where('telegramId', '==', telegramId).get();

    let user: DocumentData;
    let userId: string;

    if (!existing.empty) {
      const doc = existing.docs[0];
      userId = doc.id;
      user = doc.data();
    } else {
      const referralCode = this.generateReferralCode();
      let mentorId: string | null = null;
      let mentorUsername: string | null = null;

      if (refCode) {
        const mentorSnap = await usersRef
          .where('referralCode', '==', refCode)
          .get();
        if (!mentorSnap.empty) {
          const mentorDoc = mentorSnap.docs[0];
          mentorId = mentorDoc.id;
          mentorUsername = mentorDoc.data().username ?? null;
        }
      }

      const newUser = {
        telegramId,
        username: telegramData.username ?? null,
        firstName: telegramData.first_name ?? '',
        lastName: telegramData.last_name ?? null,
        photoUrl: telegramData.photo_url ?? null,
        points: 0,
        mentorId,
        mentorUsername,
        referralCode,
        createdAt: new Date().toISOString(),
        isAdmin: false,
        isAdvertiser: false,
      };

      const docRef = await usersRef.add(newUser);
      userId = docRef.id;
      user = newUser;
    }

    const token = this.jwt.sign({ sub: userId, telegramId });
    return { token, user: { id: userId, ...user } };
  }

  private generateReferralCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}
