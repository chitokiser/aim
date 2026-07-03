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

  async findEnded(category?: string) {
    let query = this.firebase
      .collection(COLLECTION)
      .where('status', 'in', ['ended', 'transfer_pending', 'completed', 'disputed', 'cancelled']) as FirebaseFirestore.Query;

    if (category) {
      query = query.where('category', '==', category);
    }

    const snap = await query.get();
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Record<string, unknown>[];
    docs.sort((a, b) => String(b.endsAt ?? '') > String(a.endsAt ?? '') ? 1 : -1);
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

  async adminUpdate(id: string, dto: Record<string, unknown>) {
    const ref = this.firebase.collection(COLLECTION).doc(id);
    const doc = await ref.get();
    if (!doc.exists) throw new NotFoundException('Auction not found');
    const allowed = [
      'title', 'description', 'thumbnailUrl', 'category',
      'startPrice', 'buyNowPrice', 'monthlyRevenue',
      'endsAt', 'transferMethod', 'status',
    ];
    const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const key of allowed) {
      if (dto[key] !== undefined) update[key] = dto[key];
    }
    await ref.update(update);
    return { id, ...doc.data(), ...update };
  }

  async adminDelete(id: string) {
    const ref = this.firebase.collection(COLLECTION).doc(id);
    const doc = await ref.get();
    if (!doc.exists) throw new NotFoundException('Auction not found');
    const data = doc.data() as Record<string, unknown>;
    await this.refundAllBidders(id, data);
    const bidsSnap = await this.firebase
      .collection(BIDS_COLLECTION)
      .where('auctionId', '==', id)
      .get();
    const batch = this.firebase.getFirestore().batch();
    bidsSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(ref);
    await batch.commit();
    return { deleted: id };
  }

  async adminDeleteSeed() {
    const snap = await this.firebase
      .collection(COLLECTION)
      .where('sellerId', '==', 'seed-system')
      .get();
    const batch = this.firebase.getFirestore().batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    return { deleted: snap.size };
  }

  async seedDemoAuctions(): Promise<{ inserted: number; skipped: boolean }> {
    const existing = await this.firebase
      .collection(COLLECTION)
      .where('sellerId', '==', 'seed-system')
      .limit(1)
      .get();
    if (!existing.empty) return { inserted: 0, skipped: true };

    const items = buildSeedItems(new Date());
    for (const item of items) {
      await this.firebase.collection(COLLECTION).add(item);
    }
    return { inserted: items.length, skipped: false };
  }

  // ─── Cron: auto-end expired auctions ────────────────────────────────────────

  @Cron(CronExpression.EVERY_MINUTE)
  async processExpiredAuctions() {
    const now = new Date().toISOString();
    // Single-field range query to avoid composite index requirement;
    // filter status in-memory.
    const snap = await this.firebase
      .collection(COLLECTION)
      .where('endsAt', '<=', now)
      .get();

    for (const doc of snap.docs) {
      const auction = doc.data();
      if (auction.status !== 'active') continue;
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

// ─── Seed data builder ────────────────────────────────────────────────────────

function buildSeedItems(now: Date): Record<string, unknown>[] {
  const h = 3_600_000;
  const d = 86_400_000;
  const at = (ms: number) => new Date(now.getTime() + ms).toISOString();
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  function s(
    category: string,
    title: string,
    description: string,
    monthlyRevenue: number,
    startPrice: number,
    buyNowPrice: number,
    endsInMs: number,
    bidCount: number,
    viewCount: number,
    transferMethod = 'Account credential transfer via secure channel',
  ): Record<string, unknown> {
    return {
      sellerId: 'seed-system',
      sellerName: 'AI119 Demo',
      title,
      category,
      description,
      thumbnailUrl: '',
      monthlyRevenue,
      startPrice,
      buyNowPrice,
      endsAt: at(endsInMs),
      transferMethod,
      status: 'active',
      currentBid: startPrice,
      currentBidderId: '',
      currentBidderName: '',
      bidCount,
      viewCount,
      extensionCount: 0,
      createdAt: ago(Math.floor(Math.random() * 2 * d)),
      approvedAt: ago(Math.floor(Math.random() * d)),
    };
  }

  return [
    // ── YouTube (10) ────────────────────────────────────────────────────────
    s('youtube', 'Tech Unbox Daily — 52K Subs', 'Gadget & smartphone unboxing channel. 52K subscribers, avg 80K views/month. AdSense + affiliate revenue. Monetized since 2022.', 180_000, 2_000_000, 3_500_000, 6 * d + 4 * h, 12, 340),
    s('youtube', 'Cooking With Grace — 120K Subs', 'Recipe & cooking tutorial channel. 120K subscribers, 200K monthly views. AdSense + brand deals $1,200/month.', 400_000, 5_000_000, 8_000_000, 3 * d + 2 * h, 24, 890),
    s('youtube', 'Daily Travel Vlog — 38K Subs', 'Travel vlog covering Southeast Asia, Europe & Americas. 38K subs, 60K monthly views, $300/month revenue.', 100_000, 1_200_000, 2_000_000, 9 * d, 5, 210),
    s('youtube', 'FitCore Workouts — 85K Subs', 'Fitness & home workout channel. 85K subscribers, 150K monthly views, $600/month. 4 years of content library.', 250_000, 3_000_000, 5_000_000, 2 * d + 6 * h, 31, 1_200),
    s('youtube', 'GameVault — 210K Subs', 'Gaming commentary & walkthrough channel. 210K subscribers, 500K monthly views, $1,500/month via AdSense + memberships.', 500_000, 7_000_000, 12_000_000, 7 * d, 47, 2_800),
    s('youtube', 'BeatLab Music Production — 27K Subs', 'Music production tutorials & beat showcases. 27K subs, 40K views/month, $250/month. High engagement niche audience.', 80_000, 900_000, 1_500_000, 4 * d + 8 * h, 7, 180),
    s('youtube', 'InvestSmart — 48K Subs', 'Personal finance & stock market channel. 48K subscribers, 90K monthly views, $900/month via AdSense + Patreon.', 300_000, 4_000_000, 6_500_000, 1 * d + 12 * h, 18, 620),
    s('youtube', 'DIY Home Projects — 36K Subs', 'Home improvement & crafts tutorials. 36K subs, 65K monthly views, $400/month. 5 years of evergreen content.', 130_000, 1_600_000, 2_700_000, 5 * d, 9, 290),
    s('youtube', 'LingoBoost Korean — 62K Subs', 'Korean language learning channel. 62K subscribers, 110K monthly views, $700/month. Growing 3K new subs/month.', 230_000, 2_800_000, 4_500_000, 8 * d, 14, 510),
    s('youtube', 'KidsLearn ABC — 98K Subs', 'Educational kids content (ages 3–8). 98K subscribers, 250K monthly views, $1,100/month. Safe-for-kids certified.', 370_000, 5_500_000, 9_000_000, 11 * d, 29, 1_540),

    // ── WordPress (10) ──────────────────────────────────────────────────────
    s('wordpress', 'TechPulse Blog — 55K Monthly Visitors', 'Tech news & review blog. 55,000 monthly organic visitors, DA 32, $300/month AdSense. Established 4 years.', 100_000, 1_200_000, 2_000_000, 5 * d + 2 * h, 8, 250),
    s('wordpress', 'RecipeNest — 85K Monthly Visitors', 'Food & recipe blog. 85K monthly visitors, DA 38, $800/month via ads + affiliate. 400+ published recipes.', 270_000, 3_200_000, 5_200_000, 3 * d, 16, 680),
    s('wordpress', 'MoneyWise Blog — 125K Visitors', 'Personal finance blog. 125K monthly visitors, DA 44, $1,200/month. Top 3 Google rankings for 20+ finance keywords.', 400_000, 5_000_000, 8_500_000, 7 * d + 4 * h, 22, 940),
    s('wordpress', 'WanderLux Travel — 42K Visitors', 'Luxury travel blog. 42K monthly visitors, DA 29, $400/month. Strong Pinterest traffic source.', 130_000, 1_500_000, 2_500_000, 10 * d, 5, 190),
    s('wordpress', 'HealthFirst Blog — 92K Visitors', 'Health & wellness blog. 92K monthly visitors, DA 41, $900/month. Email list of 8,000 subscribers.', 300_000, 3_600_000, 6_000_000, 4 * d + 6 * h, 20, 870),
    s('wordpress', 'StyleDiary Fashion — 73K Visitors', 'Fashion & lifestyle blog. 73K monthly visitors, DA 35, $650/month via ads + brand sponsorships.', 210_000, 2_500_000, 4_200_000, 6 * d, 11, 520),
    s('wordpress', 'PixelGamer News — 64K Visitors', 'Gaming news & reviews site. 64K monthly visitors, DA 33, $550/month. Dedicated community readership.', 180_000, 2_200_000, 3_700_000, 2 * d + 8 * h, 13, 430),
    s('wordpress', 'RealEstate Insider — 38K Visitors', 'Real estate tips & market analysis. 38K monthly visitors, DA 27, $380/month. Agent affiliate program.', 120_000, 1_400_000, 2_300_000, 9 * d, 6, 210),
    s('wordpress', 'DigMarkPro — 110K Visitors', 'Digital marketing blog. 110K monthly visitors, DA 46, $1,100/month. Premium newsletter 5,000 subscribers.', 370_000, 4_500_000, 7_500_000, 5 * d, 25, 1_100),
    s('wordpress', 'PetCare Corner — 58K Visitors', 'Pet care & training blog. 58K monthly visitors, DA 31, $480/month. Strong affiliate revenue from pet products.', 160_000, 1_900_000, 3_200_000, 8 * d + 2 * h, 9, 360),

    // ── Instagram (10) ──────────────────────────────────────────────────────
    s('instagram', 'FoodieGram — 78K Followers', 'Food photography & restaurant reviews. 78K followers, 4.2% engagement rate. Brand deal revenue $600/month.', 200_000, 2_400_000, 4_000_000, 4 * d, 15, 680),
    s('instagram', 'TravelWithMe — 130K Followers', 'Travel inspiration & destination guides. 130K followers, 3.8% engagement. $1,200/month from brand partnerships.', 400_000, 5_000_000, 8_000_000, 2 * d + 6 * h, 28, 1_450),
    s('instagram', 'FitLifeStyle — 55K Followers', 'Fitness motivation & workout tips. 55K followers, 5.1% engagement. Supplement brand partnerships $450/month.', 150_000, 1_800_000, 3_000_000, 7 * d, 11, 430),
    s('instagram', 'HomeDecorLux — 92K Followers', 'Interior design & home decoration inspiration. 92K followers, 4.5% engagement. $900/month sponsored posts.', 300_000, 3_500_000, 5_800_000, 5 * d + 4 * h, 19, 920),
    s('instagram', 'CryptoAlpha — 47K Followers', 'Crypto market analysis & trading signals. 47K followers, 6.2% engagement. Premium group subscription $1,800/month.', 600_000, 7_000_000, 11_000_000, 3 * d, 33, 1_200),
    s('instagram', 'FashionForward — 165K Followers', 'Luxury fashion & lifestyle. 165K followers, 3.5% engagement. Major brand sponsorships $2,000/month.', 650_000, 8_000_000, 13_000_000, 6 * d, 41, 2_100),
    s('instagram', 'MindfulLiving — 38K Followers', 'Mental health & mindfulness content. 38K followers, 6.8% engagement. Course sales $300/month.', 100_000, 1_200_000, 2_000_000, 9 * d, 7, 280),
    s('instagram', 'PetMoments — 62K Followers', 'Cute pet & animal content. 62K followers, 7.2% engagement. Pet brand deals $500/month.', 170_000, 2_000_000, 3_300_000, 4 * d + 8 * h, 14, 580),
    s('instagram', 'LocalEats Vietnam — 85K Followers', 'Vietnamese street food & restaurant reviews. 85K followers, 5.5% engagement. $700/month brand deals.', 230_000, 2_800_000, 4_600_000, 7 * d, 17, 730),
    s('instagram', 'GymBeast — 110K Followers', 'Bodybuilding & powerlifting content. 110K followers, 4.9% engagement. Supplement affiliate $1,000/month.', 330_000, 4_000_000, 6_500_000, 5 * d, 22, 1_080),

    // ── TikTok (10) ─────────────────────────────────────────────────────────
    s('tiktok', 'DailyComedy — 280K Followers', 'Comedy skits & trending challenges. 280K followers, avg 150K views/video. Creator fund + brand deals $800/month.', 270_000, 3_200_000, 5_300_000, 3 * d + 6 * h, 21, 1_350),
    s('tiktok', 'CookFast — 195K Followers', 'Quick recipes under 60 seconds. 195K followers, 80K avg views. Food brand sponsorships $600/month.', 200_000, 2_400_000, 4_000_000, 5 * d, 17, 890),
    s('tiktok', 'CryptoTok — 95K Followers', 'Crypto news & price analysis shorts. 95K followers, 45K avg views. Premium signal group $1,500/month.', 500_000, 6_000_000, 9_500_000, 2 * d + 4 * h, 35, 1_100),
    s('tiktok', 'StudyWithMe — 320K Followers', 'Study motivation & productivity tips. 320K followers, 200K avg views. Course sales + creator fund $1,200/month.', 400_000, 5_000_000, 8_200_000, 7 * d, 29, 2_200),
    s('tiktok', 'StreetFoodWorld — 145K Followers', 'Street food adventures across Asia. 145K followers, 70K avg views. Brand deals $500/month.', 160_000, 1_900_000, 3_200_000, 6 * d, 12, 760),
    s('tiktok', 'LifeHacks Daily — 425K Followers', 'Everyday life hacks & tips. 425K followers, 300K avg views. Creator fund + sponsorships $1,800/month.', 600_000, 7_500_000, 12_000_000, 4 * d + 12 * h, 48, 3_100),
    s('tiktok', 'GlowupBeauty — 88K Followers', 'Beauty tutorials & makeup transformations. 88K followers, 40K avg views. Beauty brand deals $450/month.', 150_000, 1_800_000, 3_000_000, 8 * d, 10, 510),
    s('tiktok', 'PetFunny — 520K Followers', 'Viral funny pet video compilation account. 520K followers, 400K avg views. Creator fund + brand $2,200/month.', 730_000, 9_000_000, 14_500_000, 1 * d + 8 * h, 55, 4_200),
    s('tiktok', 'MusicVibes — 175K Followers', 'Music discovery & artist spotlights. 175K followers, 90K avg views. Music brand partnerships $650/month.', 210_000, 2_500_000, 4_200_000, 9 * d, 14, 890),
    s('tiktok', 'KoreanLife — 230K Followers', 'Korean culture, food & lifestyle vlogs. 230K followers, 120K avg views. Korean brand deals $900/month.', 300_000, 3_600_000, 6_000_000, 5 * d + 6 * h, 26, 1_650),

    // ── Google (10) ─────────────────────────────────────────────────────────
    s('google', 'AdSense News Portal — $400/mo', 'News aggregator site with AdSense. 95K monthly pageviews, $400/month AdSense revenue. Auto-updated via RSS.', 130_000, 1_600_000, 2_700_000, 6 * d, 9, 340),
    s('google', 'Google Business — Verified 5★ Restaurant', 'Verified Google Business profile for restaurant, 5-star rating, 320 organic reviews. High local search visibility.', 0, 500_000, 900_000, 4 * d + 2 * h, 7, 180),
    s('google', 'AdSense Lifestyle Site — $650/mo', 'Lifestyle blog with AdSense approval. 120K monthly impressions, $650/month net revenue. Stable 2 years.', 210_000, 2_500_000, 4_200_000, 7 * d, 15, 560),
    s('google', 'Google Maps Listing — 4.8★ Beauty Salon', 'Established Google Maps business listing with 180 organic reviews, 4.8★ rating. Prime location category.', 0, 400_000, 700_000, 3 * d, 5, 130),
    s('google', 'AdSense Finance Site — $1,100/mo', 'Personal finance comparison site. 200K monthly pageviews, $1,100/month AdSense. Premium niche targeting.', 370_000, 4_500_000, 7_500_000, 5 * d + 8 * h, 23, 980),
    s('google', 'Google Ads Agency Account — $50K Spend', 'Seasoned Google Ads manager account with $50K+ lifetime spend, 7 active campaigns, high quality scores.', 0, 2_000_000, 3_500_000, 8 * d, 18, 640),
    s('google', 'AdSense Tech Review Site — $480/mo', 'Tech product review site. 88K monthly visitors from Google, $480/month AdSense. Affiliate links additional.', 160_000, 1_900_000, 3_200_000, 4 * d, 11, 410),
    s('google', 'Google Play Developer Account — 3 Apps', 'Established Google Play developer account with 3 published apps, combined 50K downloads. Clean policy record.', 50_000, 600_000, 1_000_000, 9 * d, 8, 220),
    s('google', 'AdSense Gaming Site — $320/mo', 'Gaming walkthroughs & tips site. 65K monthly visitors from Google search, $320/month AdSense revenue.', 110_000, 1_300_000, 2_200_000, 6 * d, 7, 290),
    s('google', 'Google Workspace Business — 10 Seats', '10-seat Google Workspace Business Plus account with custom domain. 3 years of clean usage history. Fully transferable.', 0, 300_000, 550_000, 2 * d + 4 * h, 4, 95),

    // ── Telegram Group (10) ─────────────────────────────────────────────────
    s('telegram_group', 'Crypto Signals VIP — 8,400 Members', 'Active crypto trading signals group. 8,400 members, daily signals, $1,200/month from paid subscriber tier.', 400_000, 5_000_000, 8_000_000, 3 * d + 4 * h, 27, 1_100),
    s('telegram_group', 'SEA Business Network — 12K Members', 'Business networking group for Southeast Asia. 12,000 members, active daily discussion, ad revenue $500/month.', 170_000, 2_000_000, 3_400_000, 6 * d, 14, 680),
    s('telegram_group', 'Korean Study Circle — 5,200 Members', 'Korean language learning & practice group. 5,200 members. Pinned resource library, premium membership $300/month.', 100_000, 1_200_000, 2_000_000, 8 * d, 8, 320),
    s('telegram_group', 'Freelancer Hub Vietnam — 9,800 Members', 'Freelance job board & community for Vietnamese professionals. 9,800 members. Job post ads $600/month.', 200_000, 2_400_000, 4_000_000, 4 * d + 2 * h, 19, 840),
    s('telegram_group', 'AI Tools Community — 6,500 Members', 'AI tools reviews, tutorials & discussions. 6,500 members, sponsored posts $450/month.', 150_000, 1_800_000, 3_000_000, 7 * d, 12, 490),
    s('telegram_group', 'Real Estate Deals Korea — 4,100 Members', 'Korean real estate investment discussion group. 4,100 members. Agent ad placement $350/month.', 115_000, 1_400_000, 2_300_000, 5 * d + 6 * h, 9, 270),
    s('telegram_group', 'Stock Market Alert KR — 7,300 Members', 'Korean stock market alerts & analysis. 7,300 members, premium subscription plan $900/month.', 300_000, 3_600_000, 6_000_000, 2 * d + 8 * h, 22, 760),
    s('telegram_group', 'Online Sellers Asia — 15K Members', 'E-commerce tips & product sourcing for Asian sellers. 15,000 members. Supplier ad revenue $700/month.', 230_000, 2_800_000, 4_600_000, 9 * d, 17, 1_050),
    s('telegram_group', 'Fitness Challenge Club — 3,600 Members', 'Monthly fitness challenges & accountability community. 3,600 members. Supplement sponsorship $250/month.', 80_000, 1_000_000, 1_700_000, 6 * d + 4 * h, 6, 195),
    s('telegram_group', 'Travel Deals SEA — 11K Members', 'Flash deals & travel tips for Southeast Asia. 11,000 members. Travel agency ad revenue $550/month.', 180_000, 2_200_000, 3_700_000, 4 * d, 16, 790),

    // ── Telegram Channel (10) ────────────────────────────────────────────────
    s('telegram_channel', 'Daily Tech News — 18K Subscribers', 'Daily tech news curated channel. 18,000 subscribers, 65% open rate, sponsored posts $600/month.', 200_000, 2_400_000, 4_000_000, 5 * d, 16, 720),
    s('telegram_channel', 'Crypto Gems Alpha — 25K Subscribers', 'Early crypto project discoveries. 25,000 subscribers, $1,500/month via project promotions.', 500_000, 6_000_000, 9_800_000, 2 * d + 6 * h, 35, 1_850),
    s('telegram_channel', 'Korean Cinema & Drama — 9,200 Subscribers', 'K-drama & K-movie news and reviews. 9,200 subscribers, 70% open rate. Streaming platform ads $350/month.', 115_000, 1_400_000, 2_300_000, 7 * d, 10, 380),
    s('telegram_channel', 'Startup Funding News — 14K Subscribers', 'Funding rounds & startup news for Asia. 14,000 subscribers. Sponsorship from VCs $800/month.', 270_000, 3_200_000, 5_300_000, 4 * d + 4 * h, 21, 1_020),
    s('telegram_channel', 'Daily Motivation VN — 22K Subscribers', 'Vietnamese motivation & self-improvement channel. 22,000 subscribers. Course promotions $400/month.', 130_000, 1_600_000, 2_700_000, 6 * d, 14, 840),
    s('telegram_channel', 'AI Art Gallery — 7,800 Subscribers', 'AI-generated art showcases & prompts. 7,800 subscribers, 75% open rate. Tool sponsorships $280/month.', 90_000, 1_100_000, 1_800_000, 8 * d + 2 * h, 7, 310),
    s('telegram_channel', 'Food Deals Korea — 31K Subscribers', 'Korean restaurant coupons & food deals. 31,000 subscribers, 80% open rate, $1,100/month ad revenue.', 370_000, 4_500_000, 7_200_000, 3 * d, 29, 2_100),
    s('telegram_channel', 'Forex Signals Pro — 12K Subscribers', 'Professional forex trading signals. 12,000 subscribers, premium subscription $2,000/month.', 650_000, 8_000_000, 13_000_000, 1 * d + 12 * h, 42, 1_680),
    s('telegram_channel', 'News Flash Vietnam — 45K Subscribers', 'Breaking news & trending topics in Vietnam. 45,000 subscribers. Brand sponsored posts $750/month.', 250_000, 3_000_000, 5_000_000, 5 * d + 8 * h, 23, 2_950),
    s('telegram_channel', 'Tech Tools Daily — 16K Subscribers', 'Daily software & productivity tool recommendations. 16,000 subscribers. Affiliate sales $520/month.', 170_000, 2_000_000, 3_400_000, 7 * d, 13, 680),

    // ── Telegram Bot (10) ────────────────────────────────────────────────────
    s('telegram_bot', 'Price Tracker Bot — 8,500 Active Users', 'E-commerce price tracking bot. 8,500 monthly active users, premium plan subscriptions $600/month.', 200_000, 2_400_000, 4_000_000, 4 * d + 6 * h, 14, 490),
    s('telegram_bot', 'AI Caption Generator Bot — 12K Users', 'Generates captions for Instagram/TikTok posts using AI. 12,000 active users, paid subscriptions $900/month.', 300_000, 3_600_000, 6_000_000, 6 * d, 22, 820),
    s('telegram_bot', 'Currency Converter Bot — 22K Users', 'Real-time multi-currency converter with crypto support. 22,000 active users, ad sponsorships $450/month.', 150_000, 1_800_000, 3_000_000, 8 * d, 11, 630),
    s('telegram_bot', 'Daily English Quiz Bot — 6,800 Users', 'Daily English vocabulary quizzes. 6,800 active users, premium plan $250/month.', 80_000, 1_000_000, 1_700_000, 5 * d + 2 * h, 7, 260),
    s('telegram_bot', 'AI Image Generator Bot — 18K Users', 'Text-to-image generation bot. 18,000 active users, paid credits model $1,200/month.', 400_000, 5_000_000, 8_000_000, 2 * d + 8 * h, 32, 1_450),
    s('telegram_bot', 'Group Manager Pro Bot — 9,400 Groups', 'Advanced Telegram group management & moderation bot. 9,400 active groups, subscription $700/month.', 230_000, 2_800_000, 4_600_000, 7 * d, 16, 560),
    s('telegram_bot', 'Job Alert Bot Korea — 14K Users', 'Job posting notifications for tech sector in Korea. 14,000 users, employer premium listings $850/month.', 280_000, 3_400_000, 5_600_000, 3 * d + 4 * h, 19, 740),
    s('telegram_bot', 'Recipe Assistant Bot — 5,200 Users', 'AI-powered recipe suggestions & cooking timer. 5,200 users, food brand sponsored $200/month.', 65_000, 800_000, 1_300_000, 9 * d, 5, 185),
    s('telegram_bot', 'Crypto Portfolio Tracker Bot — 16K Users', 'Real-time crypto portfolio & P&L tracker. 16,000 users, premium features $1,100/month.', 370_000, 4_500_000, 7_200_000, 4 * d, 27, 1_200),
    s('telegram_bot', 'Meme Generator Bot — 28K Users', 'Auto-meme generation from templates. 28,000 active users, viral growth, brand deals $380/month.', 125_000, 1_500_000, 2_500_000, 6 * d + 4 * h, 13, 1_850),

    // ── Jumpdao Store (10) ──────────────────────────────────────────────────
    s('jumpdao_store', 'Digital Templates Store — $400/mo', 'Canva & Figma design templates store. 400+ products, 2,000+ sales history, $400/month steady income.', 130_000, 1_600_000, 2_700_000, 5 * d, 11, 390),
    s('jumpdao_store', 'AI Prompts Collection Store — $600/mo', 'Premium AI prompt packs for Midjourney & ChatGPT. 150+ prompt bundles, $600/month recurring revenue.', 200_000, 2_400_000, 4_000_000, 3 * d + 8 * h, 18, 620),
    s('jumpdao_store', 'Stock Photo Store — $350/mo', 'Stock photo collection store. 5,000+ original photos, 1,500+ active customers, $350/month.', 115_000, 1_400_000, 2_300_000, 7 * d, 9, 310),
    s('jumpdao_store', 'NFT Art Collection Store — $800/mo', 'Digital art & NFT marketplace store. 300+ unique artworks, established buyer base, $800/month revenue.', 270_000, 3_200_000, 5_300_000, 2 * d + 6 * h, 24, 980),
    s('jumpdao_store', 'Business Card Templates Store — $250/mo', 'Professional business card & stationery templates. 200+ designs, 3,000+ downloads, $250/month.', 80_000, 1_000_000, 1_700_000, 8 * d + 4 * h, 6, 230),
    s('jumpdao_store', 'YouTube Thumbnail Templates — $500/mo', 'Custom YouTube thumbnail template store. 500+ templates, 4,500+ active customers, $500/month.', 170_000, 2_000_000, 3_300_000, 4 * d, 15, 560),
    s('jumpdao_store', 'Music Sample Packs Store — $450/mo', 'Royalty-free music loops & samples. 80+ packs, 1,200+ active customers, $450/month.', 150_000, 1_800_000, 3_000_000, 6 * d + 2 * h, 12, 400),
    s('jumpdao_store', 'Coding Templates Store — $700/mo', 'HTML/CSS/React component templates. 120+ premium templates, developer community, $700/month.', 230_000, 2_800_000, 4_600_000, 5 * d, 19, 730),
    s('jumpdao_store', 'Icon & UI Kit Store — $380/mo', 'Professional icon sets & UI kits for designers. 50+ kits, 2,800+ downloads, $380/month.', 125_000, 1_500_000, 2_500_000, 9 * d, 8, 340),
    s('jumpdao_store', 'E-book Store EN/KR/VN — $550/mo', 'Self-help & business e-books in English, Korean & Vietnamese. 45+ titles, $550/month consistent sales.', 180_000, 2_200_000, 3_700_000, 3 * d + 4 * h, 14, 490),

    // ── Jumpdao Gold (10) ────────────────────────────────────────────────────
    s('jumpdao_gold', 'Gold Tier Account — Level 8 Seller', 'Jumpdao Gold certified Level 8 seller. 2,000+ completed orders, 4.9★ rating, priority listing access.', 350_000, 4_200_000, 7_000_000, 5 * d + 4 * h, 20, 840),
    s('jumpdao_gold', 'Gold Partner — 500+ Verified Reviews', 'Top Jumpdao Gold partner with 500+ verified reviews, 4.95★ average, $800/month monthly revenue.', 270_000, 3_200_000, 5_300_000, 3 * d + 2 * h, 17, 690),
    s('jumpdao_gold', 'Gold Elite Account — $1,200/mo Revenue', 'Elite Gold tier with $1,200/month stable revenue, 1,500+ transactions, zero disputes on record.', 400_000, 5_000_000, 8_200_000, 7 * d, 28, 1_180),
    s('jumpdao_gold', 'Gold Mentor Account — 120 Referrals', 'Gold tier account with 120 active referrals in downline. Passive mentor income $650/month.', 210_000, 2_500_000, 4_200_000, 4 * d + 6 * h, 13, 520),
    s('jumpdao_gold', 'Gold Store — Premium Verified Badge', 'Fully verified Gold store with premium badge. 800+ sales, featured category placement, $450/month.', 150_000, 1_800_000, 3_000_000, 6 * d, 10, 380),
    s('jumpdao_gold', 'Gold Account — Top 50 Seller Ranked', 'Ranked Top 50 seller on Jumpdao Gold network. 3,000+ sales, VIP support access, $900/month revenue.', 300_000, 3_600_000, 6_000_000, 2 * d + 8 * h, 24, 1_050),
    s('jumpdao_gold', 'Gold Community Admin — 2K Members', 'Gold tier with community admin status. Manages 2,000-member group, affiliate bonus $380/month.', 125_000, 1_500_000, 2_500_000, 8 * d, 9, 310),
    s('jumpdao_gold', 'Gold Creator — Viral Product Portfolio', 'Gold-tier creator account with 10 viral product portfolios. $700/month residual sales.', 230_000, 2_800_000, 4_600_000, 5 * d + 6 * h, 16, 760),
    s('jumpdao_gold', 'Gold Ambassador — 5 Brand Partnerships', 'Official Gold Ambassador with 5 active brand partnerships. $1,100/month in partnership fees.', 370_000, 4_500_000, 7_500_000, 3 * d, 25, 1_300),
    s('jumpdao_gold', 'Gold Starter Kit — Ready to Scale', 'New Gold-certified account, fully set up with product listings, $250/month initial revenue stream.', 80_000, 1_000_000, 1_700_000, 10 * d, 5, 160),
  ];
}
