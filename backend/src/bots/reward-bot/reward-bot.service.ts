import { Injectable } from '@nestjs/common';
import { GroupJoinsService } from '../../group-joins/group-joins.service';
import { BaseTelegrafBotService } from '../base/base-telegraf-bot.service';
import { AuthService } from '../../auth/auth.service';
import { UsersService } from '../../users/users.service';
import { PointsService } from '../../points/points.service';
import { Markup } from 'telegraf';

const SITE = 'https://ai119.netlify.app';
const COMMUNITY = 'https://t.me/ai119link';

@Injectable()
export class RewardBotService extends BaseTelegrafBotService {
  private readonly AP_PER_STAR = 130; // ~$0.013/Star (Fragment rate) · 77 Stars = 10,000 AP = $1
  private readonly STAR_PRESETS = [39, 77, 154, 385, 770];

  constructor(
    private readonly groupJoins: GroupJoinsService,
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly pointsService: PointsService,
  ) {
    super();
  }

  protected getBotToken(): string | undefined {
    return process.env.REWARD_BOT_TOKEN;
  }

  private topupKeyboard() {
    const rows: { text: string; callback_data: string }[][] = [];
    const pairs = this.STAR_PRESETS.reduce<(typeof this.STAR_PRESETS)[]>((acc, s, i) => {
      if (i % 2 === 0) acc.push([s]);
      else acc[acc.length - 1].push(s);
      return acc;
    }, []);
    for (const pair of pairs) {
      rows.push(
        pair.map((s) => ({
          text: `⭐ ${s} Stars → ${(s * this.AP_PER_STAR).toLocaleString()} AP`,
          callback_data: `topup_${s}`,
        })),
      );
    }
    return { inline_keyboard: rows };
  }

  private async sendStarsInvoice(
    ctx: { replyWithInvoice: (args: Record<string, unknown>) => Promise<unknown> },
    user: Record<string, unknown>,
    stars: number,
  ) {
    const ap = stars * this.AP_PER_STAR;
    await ctx.replyWithInvoice({
      title: `⭐ ${stars} Stars → ${ap.toLocaleString()} AP`,
      description: `AI119 계정에 ${ap.toLocaleString()} AP (≈ $${(ap / 10_000).toFixed(2)} USD)가 즉시 충전됩니다.`,
      payload: JSON.stringify({ userId: user.id as string, stars }),
      provider_token: '',
      currency: 'XTR',
      prices: [{ label: `${ap.toLocaleString()} AP`, amount: stars }],
    });
  }

  protected registerHandlers() {
    if (!this.bot) return;

    this.bot.command('start', async (ctx) => {
      const chat = ctx.chat;
      const user = ctx.from;
      const isPrivate = chat.type === 'private';
      const payload = ctx.message.text.split(' ')[1] ?? '';

      // topup_X deep link from frontend Stars buttons  e.g. ?start=topup_100
      if (isPrivate && user && payload.startsWith('topup_')) {
        const { user: dbUser } = await this.usersService.registerFromTelegram({
          telegramId: String(user.id),
          firstName: user.first_name,
          lastName: user.last_name,
          username: user.username,
        });
        const stars = parseInt(payload.replace('topup_', ''), 10);
        if (stars > 0 && this.STAR_PRESETS.includes(stars)) {
          await this.sendStarsInvoice(ctx, dbUser as Record<string, unknown>, stars);
        } else {
          await ctx.reply(
            `⭐ *AP 충전 — Telegram Stars*\n\n환율: ⭐ 1 Star = *${this.AP_PER_STAR} AP* (10,000 AP = $1)\n\n충전할 Stars를 선택하세요:`,
            { parse_mode: 'Markdown', reply_markup: this.topupKeyboard() },
          );
        }
        return;
      }

      if (isPrivate && user) {
        const loginToken = this.authService.createBotLoginToken(String(user.id), {
          first_name: user.first_name,
          last_name: user.last_name,
          username: user.username,
        });
        await ctx.reply(
          `👋 *AI119 Reward Bot*에 오신 걸 환영합니다!\n\n그룹 참여 미션을 완료하면 AP 포인트를 획득할 수 있습니다.\n\n아래 버튼으로 AI119 플랫폼에 자동 로그인하세요 👇`,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.webApp('🚀 AI119 플랫폼 입장', `${SITE}?tg=${loginToken}`)],
              [Markup.button.url('💬 AI119 커뮤니티', COMMUNITY)],
            ]),
          },
        );
      } else {
        await ctx.reply(
          `👋 *AI119 Reward Bot*\n\n그룹 참여 미션 완료 시 AP 포인트를 자동 지급합니다.\n\n아래 버튼으로 AI119 플랫폼을 방문하세요 👇`,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.url('🚀 AI119 플랫폼', SITE)],
              [Markup.button.url('💬 AI119 커뮤니티', COMMUNITY)],
            ]),
          },
        );
      }
    });

    this.bot.command('topup', async (ctx) => {
      if (ctx.chat?.type !== 'private') {
        await ctx.reply('Use /topup in the bot DM to top up AP.');
        return;
      }
      const telegramId = String(ctx.from?.id);
      const user = (await this.usersService.findByTelegramId(telegramId)) as Record<string, unknown> | null;
      if (!user) {
        await ctx.reply('Please register first with /start');
        return;
      }

      const requestedStars = parseInt(ctx.message.text.split(' ')[1] ?? '0', 10);
      if (requestedStars > 0 && this.STAR_PRESETS.includes(requestedStars)) {
        await this.sendStarsInvoice(ctx, user, requestedStars);
      } else {
        await ctx.reply(
          `⭐ *AP 충전 — Telegram Stars*\n\n환율: ⭐ 1 Star = *${this.AP_PER_STAR} AP*\n💰 10,000 AP = $1 USD\n\n충전할 금액을 선택하세요:`,
          { parse_mode: 'Markdown', reply_markup: this.topupKeyboard() },
        );
      }
    });

    this.bot.action('topup_menu', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply(
        `⭐ *AP 충전 — Telegram Stars*\n\n환율: ⭐ 1 Star = *${this.AP_PER_STAR} AP*\n💰 10,000 AP = $1 USD\n\n충전할 금액을 선택하세요:`,
        { parse_mode: 'Markdown', reply_markup: this.topupKeyboard() },
      );
    });

    this.bot.action(/^topup_(\d+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      const telegramId = String(ctx.from?.id);
      const user = (await this.usersService.findByTelegramId(telegramId)) as Record<string, unknown> | null;
      if (!user) { await ctx.reply('Please register first with /start'); return; }

      const stars = parseInt((ctx.match as RegExpMatchArray)[1], 10);
      if (!this.STAR_PRESETS.includes(stars)) return;
      await this.sendStarsInvoice(ctx, user, stars);
    });

    this.bot.on('pre_checkout_query', async (ctx) => {
      await ctx.answerPreCheckoutQuery(true);
    });

    this.bot.on('message', async (ctx) => {
      if (ctx.chat?.type !== 'private') return;
      const msg = ctx.message as unknown as Record<string, unknown>;
      if (!msg.successful_payment) return;

      const payment = msg.successful_payment as { total_amount: number; invoice_payload: string };
      try {
        const payload = JSON.parse(payment.invoice_payload) as { userId: string; stars: number };
        const ap = payment.total_amount * this.AP_PER_STAR;
        await this.pointsService.award(
          payload.userId,
          ap,
          'stars_topup',
          `Telegram Stars top-up: ${payment.total_amount} Stars`,
        );
        await ctx.reply(
          `✅ *Top-Up Complete!*\n\n⭐ ${payment.total_amount} Stars → *${ap.toLocaleString()} AP* added to your wallet!\n💰 Total value: $${(ap / 10000).toFixed(2)} USD`,
          { parse_mode: 'Markdown' },
        );
      } catch (err) {
        this.logger.error('Stars payment processing failed', err);
        await ctx.reply('Payment received but AP crediting failed. Please contact support.');
      }
    });

    this.bot.on('new_chat_members', async (ctx) => {
      const chatId = String(ctx.chat.id);
      for (const member of ctx.message.new_chat_members) {
        if (member.is_bot) continue;
        try {
          await this.groupJoins.recordJoin(String(member.id), chatId);
          this.logger.log(`Join recorded: telegramId=${member.id} chatId=${chatId}`);
        } catch (err) {
          this.logger.error('Error recording join', err);
        }
      }
    });

    this.bot.on('left_chat_member', async (ctx) => {
      const member = ctx.message.left_chat_member;
      if (member.is_bot) return;
      const chatId = String(ctx.chat.id);
      try {
        await this.groupJoins.recordLeave(String(member.id), chatId);
        this.logger.log(`Leave recorded: telegramId=${member.id} chatId=${chatId}`);
      } catch (err) {
        this.logger.error('Error recording leave', err);
      }
    });

    // When bot is added to a group, announce the group's chat ID for advertiser reference
    this.bot.on('my_chat_member', async (ctx) => {
      const update = ctx.myChatMember;
      const newStatus = update.new_chat_member.status;
      if (newStatus === 'member' || newStatus === 'administrator') {
        const chatId = ctx.chat.id;
        await ctx.telegram.sendMessage(
          chatId,
          `✅ *AI119 Reward Bot 활성화*\n\n이 그룹의 회원 가입/퇴장을 모니터링합니다.\n광고주 미션의 그룹 ID: \`${chatId}\`\n\n이 ID를 AI119 광고주 페이지 → 그룹 가입 미션 → "그룹 ID" 항목에 입력하세요.\n\n아래 버튼으로 미션을 확인하세요 👇`,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.url('🎯 AI119 미션 보기', 'https://ai119.netlify.app/missions')],
              [Markup.button.url('🌐 AI119 커뮤니티', 'https://t.me/ai119link')],
            ]),
          },
        ).catch(() => {});
      }
    });
  }
}
