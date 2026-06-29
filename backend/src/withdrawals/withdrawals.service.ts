import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegram } from 'telegraf';
import { FirebaseService } from '../firebase/firebase.service';
import { PointsService } from '../points/points.service';

export interface WithdrawalDoc {
  id: string;
  userId: string;
  username: string;
  tonWallet: string;
  apAmount: number;
  usdAmount: number;
  status: 'pending' | 'approved' | 'rejected';
  txHash: string | null;
  adminNote: string | null;
  requestedAt: string;
  processedAt: string | null;
}

const MIN_AP = 50000;

@Injectable()
export class WithdrawalsService {
  constructor(
    private firebase: FirebaseService,
    private points: PointsService,
    private config: ConfigService,
  ) {}

  private notifyAdmin(username: string, apAmount: number, usdAmount: number, tonWallet: string) {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const adminId = this.config.get<string>('ADMIN_TELEGRAM_ID');
    if (!botToken || !adminId) return;

    const msg =
      `💸 *출금 신청 접수*\n\n` +
      `👤 회원: ${username}\n` +
      `💰 금액: ${apAmount.toLocaleString()} AP = $${usdAmount.toFixed(2)} USD\n` +
      `🔗 TON 지갑: \`${tonWallet}\`\n\n` +
      `🔍 [관리자 패널에서 처리](https://ai119.netlify.app/admin)`;

    new Telegram(botToken).sendMessage(adminId, msg, { parse_mode: 'Markdown' }).catch(() => {});
  }

  async create(userId: string, apAmount: number, tonWallet: string): Promise<WithdrawalDoc> {
    if (apAmount < MIN_AP) {
      throw new BadRequestException(`Minimum withdrawal is ${MIN_AP} AP`);
    }
    if (!tonWallet || tonWallet.trim().length < 10) {
      throw new BadRequestException('Invalid TON wallet address');
    }

    const userDoc = await this.firebase.collection('users').doc(userId).get();
    if (!userDoc.exists) throw new NotFoundException('User not found');
    const userData = userDoc.data() as Record<string, unknown>;

    const balance = (userData.points as number) ?? 0;
    if (balance < apAmount) {
      throw new BadRequestException(`Insufficient AP. Balance: ${balance}, Requested: ${apAmount}`);
    }

    // Deduct AP immediately and log transaction
    await this.points.deduct(userId, apAmount, `출금 신청 ${apAmount.toLocaleString()} AP → TON`);

    const doc: Omit<WithdrawalDoc, 'id'> = {
      userId,
      username: (userData.username as string) ?? '',
      tonWallet: tonWallet.trim(),
      apAmount,
      usdAmount: apAmount / 10000,
      status: 'pending',
      txHash: null,
      adminNote: null,
      requestedAt: new Date().toISOString(),
      processedAt: null,
    };

    const ref = await this.firebase.collection('withdrawals').add(doc);
    this.notifyAdmin(doc.username, doc.apAmount, doc.usdAmount, doc.tonWallet);
    return { id: ref.id, ...doc };
  }

  async getMyHistory(userId: string): Promise<WithdrawalDoc[]> {
    const snap = await this.firebase
      .collection('withdrawals')
      .where('userId', '==', userId)
      .get();
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<WithdrawalDoc, 'id'>) }))
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  }

  async adminList(status?: string): Promise<WithdrawalDoc[]> {
    let query = this.firebase.collection('withdrawals') as FirebaseFirestore.Query;
    if (status) query = query.where('status', '==', status);
    const snap = await query.get();
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<WithdrawalDoc, 'id'>) }))
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  }

  async approve(adminId: string, withdrawalId: string, txHash: string): Promise<WithdrawalDoc> {
    await this.assertAdmin(adminId);
    const ref = this.firebase.collection('withdrawals').doc(withdrawalId);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundException('Withdrawal not found');
    const data = snap.data() as Omit<WithdrawalDoc, 'id'>;
    if (data.status !== 'pending') throw new BadRequestException('Already processed');

    await ref.update({
      status: 'approved',
      txHash: txHash ?? null,
      processedAt: new Date().toISOString(),
    });
    return { id: withdrawalId, ...data, status: 'approved', txHash, processedAt: new Date().toISOString() };
  }

  async reject(adminId: string, withdrawalId: string, adminNote: string): Promise<WithdrawalDoc> {
    await this.assertAdmin(adminId);
    const ref = this.firebase.collection('withdrawals').doc(withdrawalId);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundException('Withdrawal not found');
    const data = snap.data() as Omit<WithdrawalDoc, 'id'>;
    if (data.status !== 'pending') throw new BadRequestException('Already processed');

    // Refund AP to user
    await this.points.award(
      data.userId,
      data.apAmount,
      'withdrawal_refund',
      `출금 거절 환불: ${adminNote ?? '사유 없음'}`,
    );

    await ref.update({
      status: 'rejected',
      adminNote: adminNote ?? null,
      processedAt: new Date().toISOString(),
    });
    return { id: withdrawalId, ...data, status: 'rejected', adminNote, processedAt: new Date().toISOString() };
  }

  private async assertAdmin(userId: string) {
    const doc = await this.firebase.collection('users').doc(userId).get();
    if (!doc.data()?.isAdmin) throw new ForbiddenException();
  }
}
