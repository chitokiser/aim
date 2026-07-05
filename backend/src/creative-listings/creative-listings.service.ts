import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { PointsService } from '../points/points.service';
import { LevelService } from '../level/level.service';

const COLLECTION = 'creative_listings';
const LIKES_COLLECTION = 'creative_listing_likes';
const LIKE_EXP_COLLECTION = 'creative_listing_like_exp';
const COMMENT_EXP_COLLECTION = 'creative_listing_comment_exp';
const CONTENT_TYPES = ['video', 'image', 'audio', 'other'];

// EXP reward rules for Creative Market activity (see project docs):
// - Registering a listing: 1000 EXP, capped at once per day per user
// - Being liked/commented on: reward to the listing owner, once per unique member per listing
// - Liking/commenting: reward to the actor, once per listing (repeat actions don't re-earn)
// Self-interaction (owner liking/commenting on their own listing) is excluded to prevent farming.
const REGISTER_EXP = 1000;
const LIKE_OWNER_EXP = 10;
const LIKE_ACTOR_EXP = 10;
const COMMENT_OWNER_EXP = 10;
const COMMENT_ACTOR_EXP = 100;

@Injectable()
export class CreativeListingsService {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly points: PointsService,
    private readonly level: LevelService,
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
    const userRef = this.firebase.collection('users').doc(userId);
    const userSnap = await userRef.get();
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

    const today = new Date().toISOString().slice(0, 10);
    if ((user.lastCreativeRegisterExpDate as string | undefined) !== today) {
      await userRef.update({ lastCreativeRegisterExpDate: today });
      await this.level.awardExp(userId, REGISTER_EXP);
    }

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

  // Likes are one-directional: once a member likes a listing, it cannot be unliked.
  async like(listingId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> {
    const ref = this.firebase.collection(COLLECTION).doc(listingId);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundException('Listing not found');

    const docId = `${userId}_${listingId}`;
    const likeRef = this.firebase.collection(LIKES_COLLECTION).doc(docId);
    const likeSnap = await likeRef.get();
    const currentCount = (snap.data()?.likeCount as number) ?? 0;

    if (likeSnap.exists) {
      return { liked: true, likeCount: currentCount };
    }

    await likeRef.set({ userId, listingId, createdAt: new Date().toISOString() });
    const newCount = currentCount + 1;
    await ref.update({ likeCount: newCount });
    await this.awardLikeExpOnce(listingId, userId, snap.data()?.sellerId as string);
    return { liked: true, likeCount: newCount };
  }

  // Awards EXP once per (member, listing) pair, the first time that member likes
  // that listing — re-liking after an unlike does not re-earn it. Self-likes are excluded.
  private async awardLikeExpOnce(listingId: string, userId: string, sellerId: string): Promise<void> {
    if (userId === sellerId) return;
    const rewardRef = this.firebase.collection(LIKE_EXP_COLLECTION).doc(`${userId}_${listingId}`);
    const rewardSnap = await rewardRef.get();
    if (rewardSnap.exists) return;
    await rewardRef.set({ userId, listingId, createdAt: new Date().toISOString() });
    await this.level.awardExp(userId, LIKE_ACTOR_EXP);
    await this.level.awardExp(sellerId, LIKE_OWNER_EXP);
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

    await this.awardCommentExpOnce(listingId, userId, snap.data()?.sellerId as string);

    return { id: commentRef.id };
  }

  // Awards EXP once per (member, listing) pair, the first time that member comments
  // on that listing — further comments by the same member on the same listing don't
  // re-earn it. Self-comments are excluded.
  private async awardCommentExpOnce(listingId: string, userId: string, sellerId: string): Promise<void> {
    if (userId === sellerId) return;
    const rewardRef = this.firebase.collection(COMMENT_EXP_COLLECTION).doc(`${userId}_${listingId}`);
    const rewardSnap = await rewardRef.get();
    if (rewardSnap.exists) return;
    await rewardRef.set({ userId, listingId, createdAt: new Date().toISOString() });
    await this.level.awardExp(userId, COMMENT_ACTOR_EXP);
    await this.level.awardExp(sellerId, COMMENT_OWNER_EXP);
  }

  // A commenter cannot delete their own comment (only edit it via editComment) —
  // deletion is a moderation action reserved for the listing owner or an admin.
  async deleteComment(listingId: string, commentId: string, userId: string): Promise<{ ok: boolean }> {
    const ref = this.firebase.collection(COLLECTION).doc(listingId);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundException('Listing not found');
    const listing = snap.data()!;

    const commentRef = ref.collection('comments').doc(commentId);
    const commentSnap = await commentRef.get();
    if (!commentSnap.exists) throw new NotFoundException('Comment not found');

    const isListingOwner = listing.sellerId === userId;
    let isAdmin = false;
    if (!isListingOwner) {
      const userSnap = await this.firebase.collection('users').doc(userId).get();
      isAdmin = !!(userSnap.exists && userSnap.data()?.isAdmin);
    }

    if (!isListingOwner && !isAdmin) {
      throw new ForbiddenException('Not authorized to delete this comment');
    }

    await commentRef.delete();
    const currentCount = (snap.data()?.commentCount as number) ?? 0;
    await ref.update({ commentCount: Math.max(0, currentCount - 1) });

    return { ok: true };
  }

  async editComment(listingId: string, commentId: string, userId: string, text: string): Promise<{ ok: boolean }> {
    const ref = this.firebase.collection(COLLECTION).doc(listingId);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundException('Listing not found');

    const commentRef = ref.collection('comments').doc(commentId);
    const commentSnap = await commentRef.get();
    if (!commentSnap.exists) throw new NotFoundException('Comment not found');
    const comment = commentSnap.data()!;

    if (comment.userId !== userId) throw new ForbiddenException('Not authorized to edit this comment');
    if (!text?.trim()) throw new BadRequestException('Comment text is required');

    await commentRef.update({
      text: text.trim().slice(0, 500),
      editedAt: new Date().toISOString(),
    });

    return { ok: true };
  }
}
