import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app: App;
  private db: Firestore;
  private firebaseAuth: Auth;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    try {
      if (getApps().length === 0) {
        const projectId = this.config.get('FIREBASE_PROJECT_ID');
        const clientEmail = this.config.get('FIREBASE_CLIENT_EMAIL');
        const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');

        if (!projectId || !clientEmail || !privateKey) {
          this.logger.error(
            'Firebase credentials missing — set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in environment variables',
          );
          return;
        }

        this.app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
        this.logger.log('Firebase Admin initialized');
      } else {
        this.app = getApps()[0];
      }
      this.db = getFirestore(this.app);
      this.firebaseAuth = getAuth(this.app);
    } catch (err) {
      this.logger.error('Firebase Admin initialization failed', err);
    }
  }

  getFirestore(): Firestore {
    if (!this.db) throw new Error('Firebase not initialized — check FIREBASE_* env vars');
    return this.db;
  }

  collection(name: string) {
    if (!this.db) throw new Error('Firebase not initialized — check FIREBASE_* env vars');
    return this.db.collection(name);
  }

  getAdminAuth(): Auth {
    if (!this.firebaseAuth) throw new Error('Firebase Auth not initialized — check FIREBASE_* env vars');
    return this.firebaseAuth;
  }
}
