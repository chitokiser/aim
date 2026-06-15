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
      req.user = { sub: decoded.uid, googleId: decoded.uid, email: decoded.email };
      return true;
    } catch { /* fall through */ }

    throw new UnauthorizedException();
  }
}
