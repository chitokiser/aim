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

  createBotLoginToken(
    telegramId: string,
    from?: { first_name?: string; last_name?: string; username?: string },
  ): string {
    return this.jwt.sign(
      {
        telegramId,
        type: 'bot-login',
        firstName: from?.first_name,
        lastName: from?.last_name,
        username: from?.username,
      },
      { expiresIn: '1h' },
    );
  }

  private verifyMiniAppInitData(initData: string): Record<string, string> | null {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;

    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();

    const checkParts: string[] = [];
    params.forEach((val, key) => {
      if (key !== 'hash') checkParts.push(`${key}=${val}`);
    });
    checkParts.sort();
    const checkString = checkParts.join('\n');

    const computedHash = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');
    if (computedHash !== hash) return null;

    const result: Record<string, string> = {};
    params.forEach((val, key) => { result[key] = val; });
    return result;
  }

  async loginFromMiniApp(initData: string) {
    const data = this.verifyMiniAppInitData(initData);
    if (!data) return null;

    let tgUser: Record<string, unknown> = {};
    try { tgUser = JSON.parse(data.user ?? '{}') as Record<string, unknown>; } catch { return null; }

    const telegramId = String(tgUser.id ?? '');
    if (!telegramId) return null;

    const result = await this.loginOrRegister({
      id: telegramId,
      username: String(tgUser.username ?? ''),
      first_name: String(tgUser.first_name ?? ''),
      last_name: String(tgUser.last_name ?? ''),
      photo_url: String(tgUser.photo_url ?? ''),
    });

    const botUsername = this.config.get<string>('TELEGRAM_BOT_USERNAME') ?? 'AIMHubBot';
    const user = result.user as Record<string, unknown>;
    const referralLink = `https://t.me/${botUsername}?start=${user.referralCode}`;
    return { ...result, referralLink };
  }

  async exchangeBotToken(oneTimeToken: string) {
    let payload: {
      telegramId: string;
      type: string;
      firstName?: string;
      lastName?: string;
      username?: string;
    };
    try {
      payload = this.jwt.verify(oneTimeToken) as typeof payload;
    } catch {
      return null;
    }
    if (payload.type !== 'bot-login') return null;

    // loginOrRegister finds existing user or auto-registers a new one with admin mentor fallback
    return this.loginOrRegister({
      id: payload.telegramId,
      first_name: payload.firstName ?? '',
      last_name: payload.lastName ?? '',
      username: payload.username ?? '',
    });
  }

  async loginFromGoogle(idToken: string, refCode?: string) {
    let decoded: { uid: string; email?: string; name?: string; picture?: string };
    try {
      decoded = await this.firebase.getAdminAuth().verifyIdToken(idToken);
    } catch {
      return null;
    }

    const usersRef = this.firebase.collection('users');
    const existing = await usersRef.where('googleId', '==', decoded.uid).get();

    let userId: string;
    let user: import('firebase-admin/firestore').DocumentData;

    if (!existing.empty) {
      const doc = existing.docs[0];
      userId = doc.id;
      user = doc.data();
      // Backfill mentorId for existing users who registered without one
      if (!user.mentorId && refCode) {
        const mentorSnap = await usersRef.where('referralCode', '==', refCode).get();
        if (!mentorSnap.empty) {
          const mentorDoc = mentorSnap.docs[0];
          const mentorData = mentorDoc.data();
          await usersRef.doc(userId).update({
            mentorId: mentorDoc.id,
            mentorUsername: mentorData.username ?? null,
          });
          await usersRef.doc(mentorDoc.id).update({ points: ((mentorData.points as number) ?? 0) + 1000 });
          user = { ...user, mentorId: mentorDoc.id, mentorUsername: mentorData.username ?? null };
        }
      }
    } else {
      const byEmail = decoded.email
        ? await usersRef.where('email', '==', decoded.email).get()
        : null;

      if (byEmail && !byEmail.empty) {
        const doc = byEmail.docs[0];
        userId = doc.id;
        const docData = doc.data();
        await usersRef.doc(userId).update({ googleId: decoded.uid });
        user = { ...docData, googleId: decoded.uid };
        // Backfill mentorId for existing users who registered without one
        if (!docData.mentorId && refCode) {
          const mentorSnap = await usersRef.where('referralCode', '==', refCode).get();
          if (!mentorSnap.empty) {
            const mentorDoc = mentorSnap.docs[0];
            const mentorData = mentorDoc.data();
            await usersRef.doc(userId).update({
              mentorId: mentorDoc.id,
              mentorUsername: mentorData.username ?? null,
            });
            await usersRef.doc(mentorDoc.id).update({ points: ((mentorData.points as number) ?? 0) + 1000 });
            user = { ...user, mentorId: mentorDoc.id, mentorUsername: mentorData.username ?? null };
          }
        }
      } else {
        const referralCode = this.generateReferralCode();
        const nameParts = (decoded.name ?? '').split(' ');

        let mentorId: string | null = null;
        let mentorUsername: string | null = null;
        let mentorCurrentPoints: number | null = null;

        if (refCode) {
          const mentorSnap = await usersRef.where('referralCode', '==', refCode).get();
          if (!mentorSnap.empty) {
            const mentorDoc = mentorSnap.docs[0];
            mentorId = mentorDoc.id;
            mentorUsername = (mentorDoc.data().username as string | null) ?? null;
            mentorCurrentPoints = (mentorDoc.data().points as number) ?? 0;
          }
        }

        if (!mentorId) {
          const adminSnap = await usersRef.where('isAdmin', '==', true).limit(1).get();
          if (!adminSnap.empty) {
            const adminDoc = adminSnap.docs[0];
            mentorId = adminDoc.id;
            mentorUsername = (adminDoc.data().username as string | null) ?? null;
            mentorCurrentPoints = (adminDoc.data().points as number) ?? 0;
          }
        }

        const newUser = {
          googleId: decoded.uid,
          email: decoded.email ?? null,
          username: decoded.email?.split('@')[0] ?? null,
          firstName: nameParts[0] ?? '',
          lastName: nameParts.slice(1).join(' ') || null,
          photoUrl: decoded.picture ?? null,
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

        if (mentorId && mentorCurrentPoints !== null) {
          await usersRef.doc(mentorId).update({ points: mentorCurrentPoints + 1000 });
        }
      }
    }

    const token = this.jwt.sign({ sub: userId, googleId: decoded.uid });
    return { token, user: { id: userId, ...user } };
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
      let mentorCurrentPoints: number | null = null;

      if (refCode) {
        const mentorSnap = await usersRef
          .where('referralCode', '==', refCode)
          .get();
        if (!mentorSnap.empty) {
          const mentorDoc = mentorSnap.docs[0];
          mentorId = mentorDoc.id;
          mentorUsername = (mentorDoc.data().username as string | null) ?? null;
          mentorCurrentPoints = (mentorDoc.data().points as number) ?? 0;
        }
      }

      // Admin fallback: auto-assign current admin as default mentor
      if (!mentorId) {
        const adminSnap = await usersRef.where('isAdmin', '==', true).limit(1).get();
        if (!adminSnap.empty) {
          const adminDoc = adminSnap.docs[0];
          mentorId = adminDoc.id;
          mentorUsername = (adminDoc.data().username as string | null) ?? null;
          mentorCurrentPoints = (adminDoc.data().points as number) ?? 0;
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

      // Credit 1,000 AP referral bonus to mentor
      if (mentorId && mentorCurrentPoints !== null) {
        await usersRef.doc(mentorId).update({ points: mentorCurrentPoints + 1000 });
      }
    }

    const token = this.jwt.sign({ sub: userId, telegramId });
    return { token, user: { id: userId, ...user } };
  }

  async bootstrapAdmin(params: {
    setupToken: string;
    firstName: string;
    username?: string;
    telegramId?: string;
    email?: string;
  }): Promise<{ token: string; user: Record<string, unknown> } | null> {
    const expected = this.config.get<string>('SETUP_SECRET');
    if (!expected || params.setupToken !== expected) return null;

    const usersRef = this.firebase.collection('users');

    // Refuse if an admin already exists — bootstrap is one-time only
    const existing = await usersRef.where('isAdmin', '==', true).limit(1).get();
    if (!existing.empty) return null;

    // If telegramId provided, promote the existing bot-registered user to admin
    if (params.telegramId) {
      const byTg = await usersRef.where('telegramId', '==', params.telegramId).limit(1).get();
      if (!byTg.empty) {
        const doc = byTg.docs[0];
        await usersRef.doc(doc.id).update({ isAdmin: true });
        const token = this.jwt.sign({ sub: doc.id, telegramId: params.telegramId });
        return { token, user: { id: doc.id, ...doc.data(), isAdmin: true } };
      }
    }

    // If email provided, check if a user with that email already exists and just promote them
    if (params.email) {
      const byEmail = await usersRef.where('email', '==', params.email).limit(1).get();
      if (!byEmail.empty) {
        const doc = byEmail.docs[0];
        await usersRef.doc(doc.id).update({ isAdmin: true });
        const token = this.jwt.sign({ sub: doc.id });
        return { token, user: { id: doc.id, ...doc.data(), isAdmin: true } };
      }
    }

    const referralCode = this.generateReferralCode();
    const newUser = {
      telegramId: params.telegramId ?? null,
      email: params.email ?? null,
      username: params.username ?? null,
      firstName: params.firstName,
      lastName: null,
      photoUrl: null,
      points: 0,
      mentorId: null,
      mentorUsername: null,
      referralCode,
      createdAt: new Date().toISOString(),
      isAdmin: true,
      isAdvertiser: false,
    };

    const docRef = await usersRef.add(newUser);
    const userId = docRef.id;
    const token = this.jwt.sign({ sub: userId });
    return { token, user: { id: userId, ...newUser } };
  }

  private generateReferralCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}
