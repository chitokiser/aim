import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FirebaseService } from '../firebase/firebase.service';
import { UsersService } from '../users/users.service';

const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const USDT_DECIMALS = 6;
const AP_PER_USD = 10_000;

interface TrongridTrc20Transfer {
  transaction_id: string;
  from: string;
  to: string;
  value: string;
  token_info: { symbol: string; address: string; decimals: number };
  block_timestamp: number;
}

@Injectable()
export class UsdtMonitorService {
  private readonly logger = new Logger(UsdtMonitorService.name);

  constructor(
    private readonly firebase: FirebaseService,
    private readonly usersService: UsersService,
  ) {}

  @Cron('0 */5 * * * *')
  async checkDeposits(): Promise<void> {
    const wallet = process.env.USDT_WALLET_ADDRESS;
    if (!wallet) { this.logger.warn('USDT_WALLET_ADDRESS not configured'); return; }
    try {
      const transfers = await this.fetchRecentTransfers(wallet);
      for (const transfer of transfers) {
        await this.processTransfer(transfer).catch((err) =>
          this.logger.error(`Error processing USDT tx ${transfer.transaction_id}`, err),
        );
      }
    } catch (err) {
      this.logger.error('USDT deposit poll failed', err);
    }
  }

  private async fetchRecentTransfers(address: string): Promise<TrongridTrc20Transfer[]> {
    const apiKey = process.env.TRONGRID_API_KEY;
    const url =
      `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20` +
      `?limit=20&only_to=true&contract_address=${USDT_CONTRACT}`;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (apiKey) headers['TRON-PRO-API-KEY'] = apiKey;

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Trongrid HTTP ${res.status}`);
    const body = (await res.json()) as { data: TrongridTrc20Transfer[]; success: boolean };
    if (!body.success) throw new Error('Trongrid success=false');
    return (body.data ?? []).filter((t) => t.token_info?.address === USDT_CONTRACT);
  }

  private async processTransfer(transfer: TrongridTrc20Transfer): Promise<void> {
    const txId = transfer.transaction_id;
    const receiptRef = this.firebase.collection('processedTopups').doc(`usdt_${txId}`);
    if ((await receiptRef.get()).exists) return;

    const usdtAmount = parseInt(transfer.value, 10) / Math.pow(10, USDT_DECIMALS);
    if (usdtAmount < 1) {
      await receiptRef.set({
        status: 'too_small',
        usdtAmount,
        txId,
        processedAt: new Date().toISOString(),
      });
      return;
    }

    const user = await this.usersService.findByTronWallet(transfer.from);
    if (!user) {
      this.logger.warn(`Unmatched USDT: ${usdtAmount} USDT from ${transfer.from}`);
      await receiptRef.set({
        status: 'unmatched',
        from: transfer.from,
        usdtAmount,
        txId,
        processedAt: new Date().toISOString(),
      });
      return;
    }

    const ap = Math.round(usdtAmount * AP_PER_USD);
    await this.usersService.addPoints(user.id as string, ap);
    await receiptRef.set({
      status: 'credited',
      userId: user.id,
      telegramId: user.telegramId,
      usdtAmount,
      ap,
      from: transfer.from,
      txId,
      processedAt: new Date().toISOString(),
    });

    this.logger.log(`✅ USDT: ${transfer.from} → ${usdtAmount} USDT → ${ap} AP credited to ${String(user.telegramId)}`);
    await this.notifyUser(String(user.telegramId), usdtAmount, ap);
  }

  private async notifyUser(telegramId: string, usdt: number, ap: number): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return;
    const text =
      `✅ <b>USDT Deposit Confirmed!</b>\n\n` +
      `💵 <b>${usdt.toFixed(2)} USDT</b> received\n` +
      `💰 <b>${ap.toLocaleString()} AP</b> credited\n` +
      `\n<i>Check balance at https://ai119.netlify.app</i>`;
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: telegramId, text, parse_mode: 'HTML' }),
    }).catch((err) => this.logger.error('Failed to notify user', err));
  }
}
