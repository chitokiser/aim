import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { PointsService } from '../points/points.service';

const BANNER_COST_AP = 10000;
const COLLECTION = 'listings';

@Injectable()
export class ListingsService {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly points: PointsService,
  ) {}

  async findAll(category?: string): Promise<unknown[]> {
    let query = this.firebase
      .collection(COLLECTION)
      .where('status', '==', 'active') as FirebaseFirestore.Query;

    if (category) {
      query = query.where('category', '==', category);
    }

    const snap = await query.get();
    type DocRow = { id: string; isFeatured?: unknown; createdAt?: unknown; [k: string]: unknown };
    const docs: DocRow[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));
    // Sort in memory to avoid requiring a Firestore composite index
    docs.sort((a, b) => {
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;
      return String(b.createdAt ?? '') > String(a.createdAt ?? '') ? 1 : -1;
    });
    return docs;
  }

  async create(userId: string, dto: Record<string, unknown>): Promise<{ id: string }> {
    if (typeof dto.title !== 'string' || !dto.title.trim()) {
      throw new BadRequestException('title is required');
    }
    if (typeof dto.link !== 'string' || !dto.link.trim()) {
      throw new BadRequestException('link is required');
    }

    const userSnap = await this.firebase.collection('users').doc(userId).get();
    if (!userSnap.exists) throw new NotFoundException('User not found');
    const user = userSnap.data()!;

    const listing = {
      userId,
      displayName: (user.firstName as string) || (user.username as string) || 'User',
      telegramId: (user.telegramId as string) || '',
      category: dto.category ?? 'group',
      title: dto.title.trim(),
      description: dto.description ?? '',
      link: dto.link.trim(),
      logoUrl: dto.logoUrl ?? '',
      tags: dto.tags ?? [],
      members: dto.members ?? null,
      isFeatured: false,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    const ref = await this.firebase.collection(COLLECTION).add(listing);
    return { id: ref.id };
  }

  async promote(listingId: string, userId: string): Promise<{ ok: boolean }> {
    const ref = this.firebase.collection(COLLECTION).doc(listingId);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundException('Listing not found');

    const data = snap.data()!;
    if (data.userId !== userId) throw new NotFoundException('Not your listing');

    const userSnap = await this.firebase.collection('users').doc(userId).get();
    const balance = (userSnap.data()?.points as number) ?? 0;
    if (balance < BANNER_COST_AP) {
      throw new BadRequestException(`Insufficient AP. Required: ${BANNER_COST_AP} AP, current balance: ${balance} AP`);
    }

    await this.points.deduct(userId, BANNER_COST_AP, `배너 광고 등록: ${data.title as string}`);

    await ref.update({
      isFeatured: true,
      featuredAt: new Date().toISOString(),
      featuredApPaid: BANNER_COST_AP,
    });

    return { ok: true };
  }

  async findByUser(userId: string): Promise<unknown[]> {
    const snap = await this.firebase
      .collection(COLLECTION)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async remove(listingId: string, userId: string): Promise<{ ok: boolean }> {
    const ref = this.firebase.collection(COLLECTION).doc(listingId);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundException('Listing not found');
    if (snap.data()!.userId !== userId) throw new NotFoundException('Not your listing');
    await ref.update({ status: 'deleted' });
    return { ok: true };
  }
}
