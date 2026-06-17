import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FirebaseService } from '../firebase/firebase.service';
import { PointsService } from '../points/points.service';

export type AuctionStatus =
  | 'pending_approval'
  | 'active'
  | 'ended'
  | 'transfer_pending'
  | 'completed'
  | 'disputed'
  | 'cancelled';

const COLLECTION = 'auctions';
const BIDS_COLLECTION = 'auction_bids';

const PLATFORM_FEE = 0.20;
const MENTOR_FEE = 0.10;
const SELLER_SHARE = 0.70;

// Anti-sniping: extend by 10 min if bid placed within this window before close
const SNIPE_WINDOW_MS = 10 * 60 * 1000;
const EXTENSION_MS = 10 * 60 * 1000;
const MAX_EXTENSIONS = 6; // max 60 min total extension

@Injectable()
export class AuctionService {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly points: PointsService,
  ) {}

  // ─── List ────────────────────────────────────────────────────────────────────

  async findAll(sort?: string, category?: string) {
    let query = this.firebase
      .collection(COLLECTION)
      .where('status', '==', 'active') as FirebaseFirestore.Query;

    if (category) {
      query = query.where('category', '==', category);
    }

    const snap = await query.get();
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Record<string, unknown>[];

    switch (sort) {
      case 'ending':
        docs.sort((a, b) => String(a.endsAt ?? '') < String(b.endsAt ?? '') ? -1 : 1);
        break;
      case 'highest':
        docs.sort((a, b) => Number(b.currentBid ?? 0) - Number(a.currentBid ?? 0));
        break;
      case 'popular':
        docs.sort((a, b) => Number(b.bidCount ?? 0) - Number(a.bidCount ?? 0));
        break;
      case 'views':
        docs.sort((a, b) => Number(b.viewCount ?? 0) - Number(a.viewCount ?? 0));
        break;
      default:
        docs.sort((a, b) => String(b.createdAt ?? '') > String(a.createdAt ?? '') ? 1 : -1);
    }

    return docs;
  }

  async findOne(id: string) {
    const doc = await this.firebase.collection(COLLECTION).doc(id).get();
    if (!doc.exists) throw new NotFoundException('Auction not found');
    // increment view count in background
    doc.ref.update({ viewCount: (doc.data()?.viewCount ?? 0) + 1 }).catch(() => {});
    return { id: doc.id, ...doc.data() };
  }

  async findBids(auctionId: string) {
    const snap = await this.firebase
      .collection(BIDS_COLLECTION)
      .where('auctionId', '==', auctionId)
      .get();
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Record<string, unknown>[];
    docs.sort((a, b) => Number(b.amount ?? 0) - Number(a.amount ?? 0));
    return docs;
  }

  // ─── Create (seller registers) ────────────────────────────────────────────────

  async create(userId: string, dto: Record<string, unknown>) {
    const userSnap = await this.firebase.collection('users').doc(userId).get();
    if (!userSnap.exists) throw new NotFoundException('User not found');
    const user = userSnap.data()!;

    const startPrice = Number(dto.startPrice ?? 0);
    if (startPrice < 10) throw new BadRequestException('Start price must be at least 10 AP');

    const endsAt = dto.endsAt ? String(dto.endsAt) : '';
    if (!endsAt || new Date(endsAt) <= new Date()) {
      throw new BadRequestException('Auction end date must be in the future');
    }

    const auction = {
      sellerId: userId,
      sellerName: String(user.firstName ?? user.username ?? 'User'),
      title: String(dto.title ?? ''),
      category: String(dto.category ?? 'other'),
      description: String(dto.description ?? ''),
      thumbnailUrl: String(dto.thumbnailUrl ?? ''),
      monthlyRevenue: Number(dto.monthlyRevenue ?? 0),
      startPrice,
      buyNowPrice: Number(dto.buyNowPrice ?? 0),
      endsAt,
      transferMethod: String(dto.transferMethod ?? ''),
      status: 'pending_approval' as AuctionStatus,
      currentBid: startPrice,
      currentBidderId: '',
      currentBidderName: '',
      bidCount: 0,
      viewCount: 0,
      extensionCount: 0,
      createdAt: new Date().toISOString(),
      approvedAt: '',
    };

    const ref = await this.firebase.collection(COLLECTION).add(auction);
    return { id: ref.id };
  }

  // ─── Bid ──────────────────────────────────────────────────────────────────────

  async placeBid(auctionId: string, bidderId: string, amount: number) {
    const auctionRef = this.firebase.collection(COLLECTION).doc(auctionId);
    const auctionDoc = await auctionRef.get();
    if (!auctionDoc.exists) throw new NotFoundException('Auction not found');

    const auction = auctionDoc.data()!;

    if (auction.status !== 'active') {
      throw new BadRequestException('Auction is not active');
    }
    if (new Date(auction.endsAt) <= new Date()) {
      throw new BadRequestException('Auction has ended');
    }
    if (auction.sellerId === bidderId) {
      throw new BadRequestException('Seller cannot bid on their own auction');
    }
    if (amount <= Number(auction.currentBid ?? 0)) {
      throw new BadRequestException(`Bid must be higher than current bid of ${auction.currentBid} AP`);
    }

    // Check bidder has enough AP
    const bidderSnap = await this.firebase.collection('users').doc(bidderId).get();
    if (!bidderSnap.exists) throw new NotFoundException('User not found');
    const bidder = bidderSnap.data()!;
    if ((bidder.points ?? 0) < amount) {
      throw new BadRequestException('Insufficient AP balance');
    }

    // Refund previous highest bidder
    const prevBidderId = String(auction.currentBidderId ?? '');
    if (prevBidderId && prevBidderId !== bidderId) {
      await this.points.award(
        prevBidderId,
        Number(auction.currentBid),
        'auction_refund',
        `Outbid refund — auction: ${auction.title}`,
      );
      // Mark previous active bid as outbid
      const prevBidSnap = await this.firebase
        .collection(BIDS_COLLECTION)
        .where('auctionId', '==', auctionId)
        .where('bidderId', '==', prevBidderId)
        .where('status', '==', 'active')
        .limit(1)
        .get();
      if (!prevBidSnap.empty) {
        await prevBidSnap.docs[0].ref.update({ status: 'outbid' });
      }
    }

    // Deduct AP from new bidder (escrow)
    await this.points.deduct(bidderId, amount, `Bid on auction: ${auction.title}`);

    // Record bid
    await this.firebase.collection(BIDS_COLLECTION).add({
      auctionId,
      bidderId,
      bidderName: String(bidder.firstName ?? bidder.username ?? 'User'),
      amount,
      status: 'active',
      createdAt: new Date().toISOString(),
    });

    // Anti-sniping: if bid is within SNIPE_WINDOW before end, extend
    const endsAt = new Date(auction.endsAt);
    const now = new Date();
    let newEndsAt = endsAt;
    let extensionCount = Number(auction.extensionCount ?? 0);

    if (endsAt.getTime() - now.getTime() < SNIPE_WINDOW_MS && extensionCount < MAX_EXTENSIONS) {
      newEndsAt = new Date(endsAt.getTime() + EXTENSION_MS);
      extensionCount += 1;
    }

    // Update auction
    await auctionRef.update({
      currentBid: amount,
      currentBidderId: bidderId,
      currentBidderName: String(bidder.firstName ?? bidder.username ?? 'User'),
      bidCount: Number(auction.bidCount ?? 0) + 1,
      endsAt: newEndsAt.toISOString(),
      extensionCount,
    });

    // Buy Now
    if (Number(auction.buyNowPrice) > 0 && amount >= Number(auction.buyNowPrice)) {
      await this.endAuction(auctionId, bidderId, amount);
      return { message: 'Buy Now! Auction ended.', extended: false, buyNow: true };
    }

    return {
      message: 'Bid placed',
      extended: newEndsAt > endsAt,
      endsAt: newEndsAt.toISOString(),
      buyNow: false,
    };
  }

  // ─── Buy Now ─────────────────────────────────────────────────────────────────

  async buyNow(auctionId: string, buyerId: string) {
    const auctionRef = this.firebase.collection(COLLECTION).doc(auctionId);
    const auctionDoc = await auctionRef.get();
    if (!auctionDoc.exists) throw new NotFoundException('Auction not found');

    const auction = auctionDoc.data()!;
    if (auction.status !== 'active') throw new BadRequestException('Auction is not active');
    if (!auction.buyNowPrice || Number(auction.buyNowPrice) === 0) {
      throw new BadRequestException('No buy-now price set');
    }
    if (auction.sellerId === buyerId) throw new BadRequestException('Cannot buy your own auction');

    const buyerSnap = await this.firebase.collection('users').doc(buyerId).get();
    if (!buyerSnap.exists) throw new NotFoundException('User not found');
    const buyer = buyerSnap.data()!;
    const price = Number(auction.buyNowPrice);

    if ((buyer.points ?? 0) < price) throw new BadRequestException('Insufficient AP');

    // Refund current highest bidder if any
    const prevBidderId = String(auction.currentBidderId ?? '');
    if (prevBidderId && prevBidderId !== buyerId) {
      await this.points.award(
        prevBidderId,
        Number(auction.currentBid),
        'auction_refund',
        `Outbid refund (buy now) — auction: ${auction.title}`,
      );
    }

    await this.points.deduct(buyerId, price, `Buy Now: ${auction.title}`);
    await this.firebase.collection(BIDS_COLLECTION).add({
      auctionId,
      bidderId: buyerId,
      bidderName: String(buyer.firstName ?? buyer.username ?? 'User'),
      amount: price,
      status: 'won',
      createdAt: new Date().toISOString(),
    });

    await this.endAuction(auctionId, buyerId, price);
    return { message: 'Purchase complete. Transfer in progress.' };
  }

  // ─── Confirm transfer (buyer confirms receipt) ───────────────────────────────

  async confirmTransfer(auctionId: string, buyerId: string) {
    const auctionRef = this.firebase.collection(COLLECTION).doc(auctionId);
    const auctionDoc = await auctionRef.get();
    if (!auctionDoc.exists) throw new NotFoundException('Auction not found');

    const auction = auctionDoc.data()!;
    if (auction.status !== 'transfer_pending') {
      throw new BadRequestException('Auction is not in transfer state');
    }
    if (auction.currentBidderId !== buyerId) {
      throw new ForbiddenException('Only the buyer can confirm transfer');
    }

    const winAmount = Number(auction.currentBid);
    const sellerId = String(auction.sellerId);

    // Distribute AP: seller 70%, mentor 10%, platform 20%
    const sellerAmount = Math.floor(winAmount * SELLER_SHARE);
    const mentorAmount = Math.floor(winAmount * MENTOR_FEE);

    await this.points.award(sellerId, sellerAmount, 'auction_sale', `Auction sale: ${auction.title}`);

    // Find seller's mentor
    const sellerSnap = await this.firebase.collection('users').doc(sellerId).get();
    if (sellerSnap.exists) {
      const sellerData = sellerSnap.data()!;
      const mentorId = String(sellerData.mentorId ?? '');
      if (mentorId) {
        await this.points.award(mentorId, mentorAmount, 'auction_mentor_fee', `Mentor fee: ${auction.title}`);
      }
    }

    await auctionRef.update({ status: 'completed', completedAt: new Date().toISOString() });
    return { message: 'Transfer confirmed. Auction completed.' };
  }

  // ─── Dispute ─────────────────────────────────────────────────────────────────

  async raiseDispute(auctionId: string, userId: string) {
    const auctionRef = this.firebase.collection(COLLECTION).doc(auctionId);
    const auctionDoc = await auctionRef.get();
    if (!auctionDoc.exists) throw new NotFoundException('Auction not found');

    const auction = auctionDoc.data()!;
    if (auction.status !== 'transfer_pending') {
      throw new BadRequestException('Can only dispute during transfer phase');
    }
    if (auction.currentBidderId !== userId && auction.sellerId !== userId) {
      throw new ForbiddenException('Only buyer or seller can raise a dispute');
    }

    await auctionRef.update({ status: 'disputed' });
    return { message: 'Dispute raised. Admin will review.' };
  }

  // ─── Admin ────────────────────────────────────────────────────────────────────

  async adminApprove(auctionId: string) {
    const auctionRef = this.firebase.collection(COLLECTION).doc(auctionId);
    const doc = await auctionRef.get();
    if (!doc.exists) throw new NotFoundException('Auction not found');
    if (doc.data()?.status !== 'pending_approval') {
      throw new BadRequestException('Auction is not pending approval');
    }
    await auctionRef.update({ status: 'active', approvedAt: new Date().toISOString() });
    return { message: 'Auction approved' };
  }

  async adminStop(auctionId: string) {
    const auctionRef = this.firebase.collection(COLLECTION).doc(auctionId);
    const doc = await auctionRef.get();
    if (!doc.exists) throw new NotFoundException('Auction not found');
    await this.refundAllBidders(auctionId, doc.data()!);
    await auctionRef.update({ status: 'cancelled' });
    return { message: 'Auction cancelled and bidders refunded' };
  }

  async adminResolveDispute(auctionId: string, resolution: 'buyer' | 'seller') {
    const auctionRef = this.firebase.collection(COLLECTION).doc(auctionId);
    const doc = await auctionRef.get();
    if (!doc.exists) throw new NotFoundException('Auction not found');

    const auction = doc.data()!;
    if (auction.status !== 'disputed') throw new BadRequestException('Auction is not disputed');

    if (resolution === 'buyer') {
      // Refund buyer
      await this.points.award(
        String(auction.currentBidderId),
        Number(auction.currentBid),
        'auction_dispute_refund',
        `Dispute resolved — refund: ${auction.title}`,
      );
      await auctionRef.update({ status: 'cancelled' });
    } else {
      // Pay seller
      const sellerAmount = Math.floor(Number(auction.currentBid) * SELLER_SHARE);
      await this.points.award(
        String(auction.sellerId),
        sellerAmount,
        'auction_sale',
        `Dispute resolved — sale: ${auction.title}`,
      );
      await auctionRef.update({ status: 'completed' });
    }

    return { message: `Dispute resolved in favor of ${resolution}` };
  }

  async adminFindAll(status?: string) {
    let query = this.firebase.collection(COLLECTION) as FirebaseFirestore.Query;
    if (status) query = query.where('status', '==', status);
    const snap = await query.get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  // ─── Cron: auto-end expired auctions ────────────────────────────────────────

  @Cron(CronExpression.EVERY_MINUTE)
  async processExpiredAuctions() {
    const now = new Date().toISOString();
    const snap = await this.firebase
      .collection(COLLECTION)
      .where('status', '==', 'active')
      .where('endsAt', '<=', now)
      .get();

    for (const doc of snap.docs) {
      const auction = doc.data();
      if (auction.currentBidderId) {
        await this.endAuction(doc.id, String(auction.currentBidderId), Number(auction.currentBid));
      } else {
        await doc.ref.update({ status: 'cancelled' });
      }
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async endAuction(auctionId: string, winnerId: string, winAmount: number) {
    const auctionRef = this.firebase.collection(COLLECTION).doc(auctionId);
    await auctionRef.update({ status: 'transfer_pending', endedAt: new Date().toISOString() });

    // Mark winning bid
    const bidSnap = await this.firebase
      .collection(BIDS_COLLECTION)
      .where('auctionId', '==', auctionId)
      .where('bidderId', '==', winnerId)
      .where('status', '==', 'active')
      .limit(1)
      .get();
    if (!bidSnap.empty) {
      await bidSnap.docs[0].ref.update({ status: 'won' });
    }
  }

  private async refundAllBidders(auctionId: string, auction: Record<string, unknown>) {
    const currentBidderId = String(auction.currentBidderId ?? '');
    if (!currentBidderId) return;
    await this.points.award(
      currentBidderId,
      Number(auction.currentBid),
      'auction_refund',
      `Auction cancelled refund: ${auction.title}`,
    );
    const bidSnap = await this.firebase
      .collection(BIDS_COLLECTION)
      .where('auctionId', '==', auctionId)
      .where('status', '==', 'active')
      .get();
    for (const bid of bidSnap.docs) {
      await bid.ref.update({ status: 'refunded' });
    }
  }
}
