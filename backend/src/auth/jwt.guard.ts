import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { FirebaseService } from '../firebase/firebase.service';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private config: ConfigService,
    private firebase: FirebaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException();

    const token = auth.slice(7);

    // Try custom JWT first
    try {
      req.user = this.jwt.verify(token, {
        secret: this.config.get<string>('JWT_SECRET') ?? 'aim-secret-key',
      });
      return true;
    } catch { /* fall through */ }

    // Fall back to Firebase ID token verification
    try {
      const decoded = await this.firebase.getAdminAuth().verifyIdToken(token);
      // Resolve the Firestore document ID from the Firebase UID so req.user.sub
      // matches what all services expect (Firestore doc ID, not Firebase UID).
      let sub = decoded.uid;
      try {
        const snap = await this.firebase
          .collection('users')
          .where('googleId', '==', decoded.uid)
          .limit(1)
          .get();
        if (!snap.empty) sub = snap.docs[0].id;
      } catch { /* use Firebase UID as fallback */ }
      req.user = { sub, googleId: decoded.uid, email: decoded.email };
      return true;
    } catch { /* fall through */ }

    throw new UnauthorizedException();
  }
}
