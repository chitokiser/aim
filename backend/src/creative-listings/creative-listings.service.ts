import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { PointsService } from '../points/points.service';

const COLLECTION = 'creative_listings';
const CONTENT_TYPES = ['video', 'image', 'audio', 'other'];

@Injectable()
export class CreativeListingsService {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly points: PointsService,
  ) {}

  async findAll(contentType?: string): Promise<unknown[]> {
    let query = this.firebase
      .collection(COLLECTION)
      .where('status', '==', 'active') as FirebaseFirestore.Query;

    if (contentType) {
      query = query.where('contentType', '==', contentType);
    }

    const snap = await query.get();
    const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));
    docs.sort((a, b) => String((b as Record<string, unknown>).createdAt ?? '') > String((a as Record<string, unknown>).createdAt ?? '') ? 1 : -1);
    return docs;
  }

  async create(userId: string, dto: Record<string, unknown>): Promise<{ id: string }> {
    const userSnap = await this.firebase.collection('users').doc(userId).get();
    if (!userSnap.exists) throw new NotFoundException('User not found');
    const user = userSnap.data()!;

    const contentType = CONTENT_TYPES.includes(dto.contentType as string) ? dto.contentType : 'other';
    const price = Number(dto.price);
    if (!Number.isFinite(price) || price <= 0) {
      throw new BadRequestException('Price must be a positive number');
    }
    if (!dto.link) {
      throw new BadRequestException('Content link is required');
    }

    const listing = {
      sellerId: userId,
      sellerName: (user.firstName as string) || (user.username as string) || 'User',
      contentType,
      title: dto.title,
      description: dto.description ?? '',
      link: dto.link,
      thumbnailUrl: dto.thumbnailUrl ?? '',
      price,
      tags: dto.tags ?? [],
      status: 'active',
      buyerId: null,
      soldAt: null,
      createdAt: new Date().toISOString(),
    };

    const ref = await this.firebase.collection(COLLECTION).add(listing);
    return { id: ref.id };
  }

  async findByUser(userId: string): Promise<unknown[]> {
    const snap = await this.firebase
      .collection(COLLECTION)
      .where('sellerId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async findPurchasesByUser(userId: string): Promise<unknown[]> {
    const snap = await this.firebase
      .collection(COLLECTION)
      .where('buyerId', '==', userId)
      .get();
    const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));
    docs.sort((a, b) => String((b as Record<string, unknown>).soldAt ?? '') > String((a as Record<string, unknown>).soldAt ?? '') ? 1 : -1);
    return docs;
  }

  async purchase(listingId: string, buyerId: string): Promise<{ ok: boolean }> {
    const ref = this.firebase.collection(COLLECTION).doc(listingId);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundException('Listing not found');

    const listing = snap.data()!;
    if (listing.status !== 'active') throw new BadRequestException('This listing is no longer available');
    if (listing.sellerId === buyerId) throw new ForbiddenException('You cannot purchase your own listing');

    const price = listing.price as number;

    const buyerSnap = await this.firebase.collection('users').doc(buyerId).get();
    if (!buyerSnap.exists) throw new NotFoundException('Buyer not found');
    const buyerBalance = (buyerSnap.data()?.points as number) ?? 0;
    if (buyerBalance < price) throw new BadRequestException('Insufficient AP balance. Please top up first.');

    const sellerId = listing.sellerId as string;
    const sellerSnap = await this.firebase.collection('users').doc(sellerId).get();
    const mentorId = (sellerSnap.data()?.mentorId as string | null) ?? null;

    await this.points.deduct(buyerId, price, `Copyright purchase: ${listing.title as string}`);

    const mentorShare = mentorId ? Math.floor(price * 0.1) : 0;
    const sellerShare = price - Math.floor(price * 0.2) - mentorShare;

    await this.points.award(sellerId, sellerShare, 'creative_sale', `Copyright sale: ${listing.title as string}`);

    if (mentorId) {
      await this.points.award(mentorId, mentorShare, 'mentor_bonus', `Mentor bonus: copyright sale referral`);
    }

    await ref.update({
      status: 'sold',
      buyerId,
      soldAt: new Date().toISOString(),
    });

    return { ok: true };
  }

  async remove(listingId: string, userId: string): Promise<{ ok: boolean }> {
    const ref = this.firebase.collection(COLLECTION).doc(listingId);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundException('Listing not found');
    const listing = snap.data()!;
    if (listing.sellerId !== userId) throw new ForbiddenException('Not your listing');
    if (listing.status !== 'active') throw new BadRequestException('Cannot remove a listing that has already been sold');
    await ref.update({ status: 'deleted' });
    return { ok: true };
  }
}
