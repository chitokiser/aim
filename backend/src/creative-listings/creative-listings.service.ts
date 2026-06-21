import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { PointsService } from '../points/points.service';

const COLLECTION = 'creative_listings';
const LIKES_COLLECTION = 'creative_listing_likes';
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
    if (listing.sellerId !== userId) {
      const userSnap = await this.firebase.collection('users').doc(userId).get();
      if (!userSnap.exists || !userSnap.data()?.isAdmin) throw new ForbiddenException('Not your listing');
    }
    if (listing.status !== 'active') throw new BadRequestException('Cannot remove a listing that has already been sold');
    await ref.update({ status: 'deleted' });
    return { ok: true };
  }

  async update(listingId: string, userId: string, dto: Record<string, unknown>): Promise<{ ok: boolean }> {
    const ref = this.firebase.collection(COLLECTION).doc(listingId);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundException('Listing not found');
    const listing = snap.data()!;

    if (listing.sellerId !== userId) {
      const userSnap = await this.firebase.collection('users').doc(userId).get();
      if (!userSnap.exists || !userSnap.data()?.isAdmin) throw new ForbiddenException('Not authorized to edit this listing');
    }
    if (listing.status === 'deleted') throw new BadRequestException('Listing is deleted');

    const allowed: Record<string, unknown> = {};
    if (dto.title !== undefined) allowed.title = String(dto.title).slice(0, 200);
    if (dto.description !== undefined) allowed.description = String(dto.description).slice(0, 1000);
    if (dto.link !== undefined) allowed.link = dto.link;
    if (dto.thumbnailUrl !== undefined) allowed.thumbnailUrl = dto.thumbnailUrl;
    if (dto.tags !== undefined) allowed.tags = dto.tags;
    if (dto.contentType !== undefined && CONTENT_TYPES.includes(dto.contentType as string)) {
      allowed.contentType = dto.contentType;
    }
    if (dto.price !== undefined && listing.status === 'active') {
      const price = Number(dto.price);
      if (Number.isFinite(price) && price > 0) allowed.price = price;
    }

    if (Object.keys(allowed).length === 0) throw new BadRequestException('No valid fields to update');
    await ref.update(allowed);
    return { ok: true };
  }

  async toggleLike(listingId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> {
    const ref = this.firebase.collection(COLLECTION).doc(listingId);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundException('Listing not found');

    const docId = `${userId}_${listingId}`;
    const likeRef = this.firebase.collection(LIKES_COLLECTION).doc(docId);
    const likeSnap = await likeRef.get();
    const currentCount = (snap.data()?.likeCount as number) ?? 0;

    if (likeSnap.exists) {
      await likeRef.delete();
      const newCount = Math.max(0, currentCount - 1);
      await ref.update({ likeCount: newCount });
      return { liked: false, likeCount: newCount };
    } else {
      await likeRef.set({ userId, listingId, createdAt: new Date().toISOString() });
      const newCount = currentCount + 1;
      await ref.update({ likeCount: newCount });
      return { liked: true, likeCount: newCount };
    }
  }

  async getMyLikedIds(userId: string): Promise<string[]> {
    const snap = await this.firebase
      .collection(LIKES_COLLECTION)
      .where('userId', '==', userId)
      .get();
    return snap.docs.map((d) => (d.data() as { listingId: string }).listingId);
  }

  async getComments(listingId: string): Promise<unknown[]> {
    const ref = this.firebase.collection(COLLECTION).doc(listingId);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundException('Listing not found');
    const commentsSnap = await ref.collection('comments').orderBy('createdAt', 'asc').get();
    return commentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async addComment(listingId: string, userId: string, text: string): Promise<{ id: string }> {
    const ref = this.firebase.collection(COLLECTION).doc(listingId);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundException('Listing not found');

    const userSnap = await this.firebase.collection('users').doc(userId).get();
    if (!userSnap.exists) throw new NotFoundException('User not found');
    const user = userSnap.data()!;
    const userName = (user.firstName as string) || (user.username as string) || 'User';

    if (!text?.trim()) throw new BadRequestException('Comment text is required');

    const commentRef = await ref.collection('comments').add({
      userId,
      userName,
      text: text.trim().slice(0, 500),
      createdAt: new Date().toISOString(),
    });

    const currentCount = (snap.data()?.commentCount as number) ?? 0;
    await ref.update({ commentCount: currentCount + 1 });

    return { id: commentRef.id };
  }

  async deleteComment(listingId: string, commentId: string, userId: string): Promise<{ ok: boolean }> {
    const ref = this.firebase.collection(COLLECTION).doc(listingId);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundException('Listing not found');
    const listing = snap.data()!;

    const commentRef = ref.collection('comments').doc(commentId);
    const commentSnap = await commentRef.get();
    if (!commentSnap.exists) throw new NotFoundException('Comment not found');
    const comment = commentSnap.data()!;

    const isCommentOwner = comment.userId === userId;
    const isListingOwner = listing.sellerId === userId;
    let isAdmin = false;
    if (!isCommentOwner && !isListingOwner) {
      const userSnap = await this.firebase.collection('users').doc(userId).get();
      isAdmin = !!(userSnap.exists && userSnap.data()?.isAdmin);
    }

    if (!isCommentOwner && !isListingOwner && !isAdmin) {
      throw new ForbiddenException('Not authorized to delete this comment');
    }

    await commentRef.delete();
    const currentCount = (snap.data()?.commentCount as number) ?? 0;
    await ref.update({ commentCount: Math.max(0, currentCount - 1) });

    return { ok: true };
  }
}
