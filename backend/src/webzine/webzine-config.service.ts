import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { CATEGORIES } from './webzine.constants';

interface WebzineState {
  enabled: Record<string, boolean>;
  lastRunAt: Record<string, string>;
}

@Injectable()
export class WebzineConfigService {
  constructor(private readonly firebase: FirebaseService) {}

  private get doc() {
    return this.firebase.collection('webzine_config').doc('state');
  }

  async getState(): Promise<WebzineState> {
    const snap = await this.doc.get();
    const data = (snap.exists ? snap.data() : {}) as Partial<WebzineState> | undefined;

    const enabled: Record<string, boolean> = {};
    for (const c of CATEGORIES) enabled[c.slug] = data?.enabled?.[c.slug] ?? true;

    return { enabled, lastRunAt: data?.lastRunAt ?? {} };
  }

  async setEnabled(category: string, enabled: boolean): Promise<void> {
    await this.doc.set({ enabled: { [category]: enabled } }, { merge: true });
  }

  async markRun(category: string): Promise<void> {
    await this.doc.set({ lastRunAt: { [category]: new Date().toISOString() } }, { merge: true });
  }
}
