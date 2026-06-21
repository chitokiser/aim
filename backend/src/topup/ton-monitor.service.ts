import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FirebaseService } from '../firebase/firebase.service';
import { UsersService } from '../users/users.service';

const AP_PER_USD = 10_000;

interface TonCenterTx {
  transaction_id: { hash: string; lt: string };
  in_msg: { value: string; message?: string; source: string };
  utime: number;
}

@Injectable()
export class TonMonitorService {
  private readonly logger = new Logger(TonMonitorService.name);

  constructor(
    private readonly firebase: FirebaseService,
    private readonly usersService: UsersService,
  ) {}

  @Cron('0 */5 * * * *')
  async checkDeposits(): Promise<void> {
    const wallet = process.env.TON_WALLET_ADDRESS;
    if (!wallet) {
      this.logger.warn('TON_WALLET_ADDRESS not configured — skipping poll');
      return;
    }
    try {
      const txs = await this.fetchRecentTxs(wallet);
      for (const tx of txs) {
        await this.processTx(tx).catch((err) =>
          this.logger.error(`Error processing tx ${tx.transaction_id.hash}`, err),
        );
      }
    } catch (err) {
      this.logger.error('TON deposit poll failed', err);
    }
  }

  private async fetchRecentTxs(wallet: string): Promise<TonCenterTx[]> {
    const apiKey = process.env.TONCENTER_API_KEY;
    const url = `https://toncenter.com/api/v2/getTransactions?address=${wallet}&limit=20&archival=false`;
    const headers: Record<string, string> = {};
    if (apiKey) headers['X-API-Key'] = apiKey;

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`TonCenter HTTP ${res.status}`);
    const body = (await res.json()) as { ok: boolean; result: TonCenterTx[] };
    if (!body.ok) throw new Error('TonCenter ok=false');
    return body.result ?? [];
  }

  private async processTx(tx: TonCenterTx): Promise<void> {
    const hash = tx.transaction_id.hash;
    const nanotons = parseInt(tx.in_msg?.value ?? '0', 10);
    if (nanotons <= 0) return;

    // Idempotency: skip already-processed txs
    const receiptRef = this.firebase.collection('processedTopups').doc(hash);
    if ((await receiptRef.get()).exists) return;

    // Extract Telegram ID from transfer comment
    const comment = (tx.in_msg?.message ?? '').trim();
    const telegramId = comment.replace(/\D/g, '');

    if (!telegramId) {
      await receiptRef.set({
        status: 'unmatched',
        comment,
        nanotons,
        utime: tx.utime,
        processedAt: new Date().toISOString(),
      });
      this.logger.warn(`Unmatched TON deposit: ${nanotons} nanoton, comment="${comment}"`);
      return;
    }

    const user = await this.usersService.findByTelegramId(telegramId);
    if (!user) {
      await receiptRef.set({
        status: 'user_not_found',
        telegramId,
        nanotons,
        utime: tx.utime,
        processedAt: new Date().toISOString(),
      });
      this.logger.warn(`TON deposit user not found: telegramId=${telegramId}`);
      return;
    }

    const tonAmount = nanotons / 1e9;
    const tonUsd = await this.fetchTonPrice();
    const ap = Math.round(tonAmount * tonUsd * AP_PER_USD);

    await this.usersService.addPoints(user.id as string, ap);

    await receiptRef.set({
      status: 'credited',
      telegramId,
      userId: user.id,
      tonAmount,
      tonUsd,
      ap,
      fromAddress: tx.in_msg.source,
      utime: tx.utime,
      processedAt: new Date().toISOString(),
    });

    this.logger.log(`✅ ${telegramId}: ${tonAmount} TON → ${ap} AP credited`);
    await this.notifyUser(telegramId, tonAmount, ap, tonUsd);
  }

  private async fetchTonPrice(): Promise<number> {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd',
    );
    const data = (await res.json()) as { 'the-open-network': { usd: number } };
    return data['the-open-network'].usd;
  }

  private async notifyUser(telegramId: string, ton: number, ap: number, tonUsd: number): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return;

    const text =
      `✅ <b>TON Deposit Confirmed!</b>\n\n` +
      `💎 <b>${ton.toFixed(4)} TON</b> received\n` +
      `💰 <b>${ap.toLocaleString()} AP</b> credited to your account\n` +
      `📈 Rate applied: $${tonUsd.toFixed(2)} / TON\n\n` +
      `<i>Check your balance at https://ai119.netlify.app</i>`;

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: telegramId, text, parse_mode: 'HTML' }),
    }).catch((err) => this.logger.error('Failed to send Telegram notification', err));
  }
}
