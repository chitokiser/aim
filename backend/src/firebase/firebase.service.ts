import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app: App;
  private db: Firestore;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    if (getApps().length === 0) {
      this.app = initializeApp({
        credential: cert({
          projectId: this.config.get('FIREBASE_PROJECT_ID'),
          clientEmail: this.config.get('FIREBASE_CLIENT_EMAIL'),
          privateKey: this.config.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
        }),
      });
      this.logger.log('Firebase Admin initialized');
    } else {
      this.app = getApps()[0];
    }
    this.db = getFirestore(this.app);
  }

  getFirestore(): Firestore {
    return this.db;
  }

  collection(name: string) {
    return this.db.collection(name);
  }
}
