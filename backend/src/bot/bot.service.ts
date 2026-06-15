import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';
import { UsersService } from '../users/users.service';
import { MissionsService } from '../missions/missions.service';
import { AuthService } from '../auth/auth.service';
import { PointsService } from '../points/points.service';

const SITE = 'https://ai119.netlify.app';

@Injectable()
export class BotService implements OnModuleInit {
  private readonly logger = new Logger(BotService.name);
  private bot: Telegraf;

  // 1 Telegram Star ≈ $0.013 USD; we credit 100 AP per Star (10,000 AP = $1)
  private readonly AP_PER_STAR = 100;

  constructor(
    private config: ConfigService,
    private usersService: UsersService,
    private missionsService: MissionsService,
    private authService: AuthService,
    private pointsService: PointsService,
  ) {}

  async onModuleInit() {
    try {
      const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
      if (!token) {
        this.logger.warn('TELEGRAM_BOT_TOKEN not set — bot disabled');
        return;
      }

      this.bot = new Telegraf(token);
      this.registerCommands();

      this.bot.launch().catch((err) => this.logger.error('Bot launch failed', err));
      this.logger.log('Telegram bot started');
    } catch (err) {
      this.logger.error('Bot initialization failed — bot disabled', err);
    }
  }

  private mainKeyboard(loginToken?: string) {
    const q = loginToken ? `?tg=${loginToken}` : '';
    return {
      inline_keyboard: [
        [
          { text: '🚀 AI119 시작하기', url: `${SITE}${q}` },
          { text: '🔗 초대링크', callback_data: 'get_invite' },
        ],
        [
          { text: '🎯 미션', url: `${SITE}/missions${q}` },
          { text: '🏆 랭킹', url: `${SITE}/leaderboard${q}` },
        ],
      ],
    };
  }

  private registerCommands() {
    this.bot.command('start', async (ctx) => {
      const tg = ctx.from;
      const payload = ctx.message.text.split(' ')[1] ?? '';
      const isGroup = ctx.chat?.type !== 'private';
      const botUsername =
        this.config.get<string>('TELEGRAM_BOT_USERNAME') ?? 'ai_bootcamp_hub_bot';

      if (isGroup) {
        await this.usersService.registerFromTelegram({
          telegramId: String(tg.id),
          firstName: tg.first_name,
          lastName: tg.last_name,
          username: tg.username,
        });
        await ctx.reply(
          `👋 *${tg.first_name}님, AI119에 오신 것을 환영합니다!*\n\n아래 버튼을 눌러 봇을 열고 자동 로그인하세요 👇`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🚀 AI119 시작하기', url: `https://t.me/${botUsername}?start=login` }],
              ],
            },
          },
        );
        return;
      }

      // payload = 'login' → came from group "AI119 시작하기" button → send login link directly
      if (payload === 'login' || payload === 'group') {
        const { user, isNew } = await this.usersService.registerFromTelegram({
          telegramId: String(tg.id),
          firstName: tg.first_name,
          lastName: tg.last_name,
          username: tg.username,
        });
        const userData = user as Record<string, unknown>;
        const loginToken = this.authService.createBotLoginToken(String(tg.id), tg);
        const welcomeText = isNew
          ? `🎉 *${tg.first_name}님 가입을 축하합니다!*\n\n🔗 추천코드: \`${userData.referralCode}\`\n\n`
          : `👋 *${tg.first_name}님 돌아오셨군요!*\n\n`;

        await ctx.reply(
          `${welcomeText}아래 버튼을 눌러 AI119에 자동 로그인하세요 🔐`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '✅ AI119 로그인하기', url: `${SITE}?tg=${loginToken}` }],
              ],
            },
          },
        );
        return;
      }

      const refCode = payload.startsWith('AIM') ? payload : undefined;

      const { user, isNew } = await this.usersService.registerFromTelegram({
        telegramId: String(tg.id),
        firstName: tg.first_name,
        lastName: tg.last_name,
        username: tg.username,
        refCode,
      });

      const userData = user as Record<string, unknown>;
      const loginToken = this.authService.createBotLoginToken(String(tg.id), tg);

      const greeting = isNew
        ? `🎉 *Welcome, ${tg.first_name}!*\n\n✅ Registration complete!\n🔗 Your referral code: \`${userData.referralCode}\`\n👨‍🏫 Mentor: ${userData.mentorId ? 'Assigned ✅' : 'None'}\n\n`
        : `👋 *Welcome back, ${tg.first_name}!*\n\n`;

      await ctx.reply(
        `${greeting}` +
          `🎯 *AI119 — Earn with AI Content*\n\n` +
          `📌 Complete missions → earn AP (AimPoints).\n` +
          `💰 10,000 AP = 1 USD (withdraw via TON/USDT)\n\n` +
          `Tap a button to get started! 👇`,
        {
          parse_mode: 'Markdown',
          reply_markup: this.mainKeyboard(loginToken),
        },
      );
    });

    this.bot.command('invite', async (ctx) => {
      if (ctx.chat?.type !== 'private') {
        await ctx.reply('Use this command in the bot DM.');
        return;
      }
      await this.handleGetInvite(ctx);
    });

    this.bot.action('get_invite', async (ctx) => {
      await ctx.answerCbQuery();
      await this.handleGetInvite(ctx);
    });

    this.bot.command('menu', async (ctx) => {
      const loginToken = this.authService.createBotLoginToken(String(ctx.from?.id), ctx.from);
      await ctx.reply(`📋 *AI119 Main Menu*`, {
        parse_mode: 'Markdown',
        reply_markup: this.mainKeyboard(loginToken),
      });
    });

    this.bot.command('mission', async (ctx) => {
      const missions = await this.missionsService.findAll('active');
      const loginToken = this.authService.createBotLoginToken(String(ctx.from?.id), ctx.from);

      if (missions.length === 0) {
        await ctx.reply('No active missions right now.', {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎯 Missions Page', url: `${SITE}/missions?tg=${loginToken}` }],
            ],
          },
        });
        return;
      }

      const list = missions
        .slice(0, 5)
        .map(
          (m: Record<string, unknown>, i: number) =>
            `${i + 1}. *${m.title}* — ${(m.reward as number).toLocaleString()} AP`,
        )
        .join('\n');

      await ctx.reply(`🎯 *Active Missions*\n\n${list}`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 View All Missions', url: `${SITE}/missions?tg=${loginToken}` }],
          ],
        },
      });
    });

    this.bot.command('rank', async (ctx) => {
      const board = await this.usersService.getLeaderboard('all');
      const top5 = board.slice(0, 5);
      const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
      const list = top5
        .map(
          (u: Record<string, unknown>, i: number) =>
            `${medals[i]} ${u.firstName} — ${(u.points as number).toLocaleString()} AP`,
        )
        .join('\n');

      const loginToken = this.authService.createBotLoginToken(String(ctx.from?.id), ctx.from);

      await ctx.reply(`🏆 *Top 5 Leaderboard*\n\n${list}`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏆 Full Leaderboard', url: `${SITE}/leaderboard?tg=${loginToken}` }],
          ],
        },
      });
    });

    this.bot.command('profile', async (ctx) => {
      const telegramId = String(ctx.from?.id);
      const user = (await this.usersService.findByTelegramId(telegramId)) as Record<string, unknown> | null;
      if (!user) {
        await ctx.reply('Please register first with /start');
        return;
      }

      const points = user.points as number;
      const loginToken = this.authService.createBotLoginToken(telegramId, ctx.from);

      await ctx.reply(
        `👤 *My Profile*\n\n` +
          `Name: ${user.firstName}\n` +
          `Points: *${points.toLocaleString()} AP*\n` +
          `USD value: $${(points / 10000).toFixed(2)}\n` +
          `Referral code: \`${user.referralCode}\`\n` +
          `Mentor: ${user.mentorId ? 'Assigned ✅' : 'None'}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '👤 View Profile', url: `${SITE}/profile?tg=${loginToken}` }],
              [{ text: '💸 Withdraw', url: `${SITE}/profile?tg=${loginToken}` }],
            ],
          },
        },
      );
    });

    this.bot.command('reward', async (ctx) => {
      const telegramId = String(ctx.from?.id);
      const user = (await this.usersService.findByTelegramId(telegramId)) as Record<string, unknown> | null;
      if (!user) {
        await ctx.reply('Please register first with /start');
        return;
      }

      const points = user.points as number;
      const loginToken = this.authService.createBotLoginToken(telegramId, ctx.from);

      await ctx.reply(
        `💰 *Withdrawal Info*\n\n` +
          `Balance: *${points.toLocaleString()} AP*\n` +
          `Withdrawable: *$${(points / 10000).toFixed(2)} USD*\n\n` +
          `Minimum withdrawal: 50,000 AP (= $5)\n` +
          `Rate: 10,000 AP = $1 USD`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '💸 Withdraw', url: `${SITE}/profile?tg=${loginToken}` }],
            ],
          },
        },
      );
    });

    // ── Telegram Stars top-up ──────────────────────────────────────────────────

    this.bot.command('login', async (ctx) => {
      if (ctx.chat?.type !== 'private') {
        await ctx.reply('봇 DM에서 /login 을 입력하면 로그인 링크를 받을 수 있습니다.');
        return;
      }
      const tg = ctx.from;
      const { user } = await this.usersService.registerFromTelegram({
        telegramId: String(tg.id),
        firstName: tg.first_name,
        lastName: tg.last_name,
        username: tg.username,
      });
      const userData = user as Record<string, unknown>;
      const loginToken = this.authService.createBotLoginToken(String(tg.id), tg);
      await ctx.reply(
        `🔐 *${tg.first_name}님의 로그인 링크*\n\n🔗 추천코드: \`${userData.referralCode}\`\n\n아래 버튼을 눌러 AI119에 자동 로그인하세요.\n⏰ 이 링크는 1시간 후 만료됩니다.`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ AI119 로그인하기', url: `${SITE}?tg=${loginToken}` }],
            ],
          },
        },
      );
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

      const args = ctx.message.text.split(' ');
      const requestedStars = args[1] ? parseInt(args[1], 10) : 0;

      const presets = [100, 500, 1000, 5000];

      if (!requestedStars || !presets.includes(requestedStars)) {
        const buttons = presets.map((s) => ({
          text: `⭐ ${s} Stars → ${(s * this.AP_PER_STAR).toLocaleString()} AP`,
          callback_data: `topup_${s}`,
        }));
        await ctx.reply(
          `💰 *AP Top-Up via Telegram Stars*\n\n` +
            `Rate: ⭐ 1 Star = *${this.AP_PER_STAR} AP*\n` +
            `10,000 AP = $1 USD\n\n` +
            `Choose an amount:`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [buttons[0], buttons[1]],
                [buttons[2], buttons[3]],
              ],
            },
          },
        );
        return;
      }

      const ap = requestedStars * this.AP_PER_STAR;
      await ctx.replyWithInvoice({
        title: `AP Top-Up — ${requestedStars} Stars`,
        description: `Receive ${ap.toLocaleString()} AP (≈ $${(ap / 10000).toFixed(2)} USD) in your AI119 wallet.`,
        payload: JSON.stringify({ userId: user.id as string, stars: requestedStars }),
        provider_token: '',
        currency: 'XTR',
        prices: [{ label: `${ap.toLocaleString()} AP`, amount: requestedStars }],
      });
    });

    this.bot.action(/^topup_(\d+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      const telegramId = String(ctx.from?.id);
      const user = (await this.usersService.findByTelegramId(telegramId)) as Record<string, unknown> | null;
      if (!user) return;

      const stars = parseInt((ctx.match as RegExpMatchArray)[1], 10);
      const ap = stars * this.AP_PER_STAR;
      await ctx.replyWithInvoice({
        title: `AP Top-Up — ${stars} Stars`,
        description: `Receive ${ap.toLocaleString()} AP (≈ $${(ap / 10000).toFixed(2)} USD) in your AI119 wallet.`,
        payload: JSON.stringify({ userId: user.id as string, stars }),
        provider_token: '',
        currency: 'XTR',
        prices: [{ label: `${ap.toLocaleString()} AP`, amount: stars }],
      });
    });

    this.bot.on('pre_checkout_query', async (ctx) => {
      await ctx.answerPreCheckoutQuery(true);
    });

    this.bot.on('chat_join_request', async (ctx) => {
      const req = ctx.update.chat_join_request;
      if (!req) return;

      const applicant = req.from;
      const chatId = req.chat.id;
      const linkName = req.invite_link?.name;

      const refCode = linkName?.startsWith('AIM') ? linkName : undefined;

      const { user, isNew } = await this.usersService.registerFromTelegram({
        telegramId: String(applicant.id),
        firstName: applicant.first_name,
        lastName: applicant.last_name,
        username: applicant.username,
        refCode,
      });

      const userData = user as Record<string, unknown>;

      await ctx.telegram.approveChatJoinRequest(chatId, applicant.id);

      this.logger.log(
        `[JoinRequest] ${applicant.first_name} (id:${applicant.id}) via ${refCode ?? 'direct'} — isNew:${isNew}`,
      );

      if (isNew && userData.mentorId) {
        const mentor = (await this.usersService.findById(userData.mentorId as string)) as Record<string, unknown> | null;
        if (mentor?.telegramId) {
          await ctx.telegram
            .sendMessage(
              mentor.telegramId as string,
              `🎉 *New mentee joined!*\n\n` +
                `👤 ${applicant.first_name}${applicant.username ? ` (@${applicant.username})` : ''}\n` +
                `💰 Referral bonus *1,000 AP* credited!`,
              { parse_mode: 'Markdown' },
            )
            .catch(() => {});
        }
      }
    });

    this.bot.on('new_chat_members', async (ctx) => {
      const newMembers = ctx.message.new_chat_members;
      const botUsername =
        this.config.get<string>('TELEGRAM_BOT_USERNAME') ?? 'ai_bootcamp_hub_bot';

      for (const member of newMembers) {
        if (member.is_bot) continue;

        const { isNew } = await this.usersService.registerFromTelegram({
          telegramId: String(member.id),
          firstName: member.first_name,
          lastName: member.last_name,
          username: member.username,
        });

        if (!isNew) continue;

        const mention = member.username
          ? `@${member.username}`
          : `[${member.first_name}](tg://user?id=${member.id})`;

        await ctx.reply(
          `✅ ${mention}님 AI119에 오신 것을 환영합니다!\n\n` +
            `🎯 미션 완료 → AP 적립 → USD 출금!\n` +
            `💰 10,000 AP = 1 USD (TON/USDT)\n\n` +
            `👇 아래 버튼을 눌러 바로 로그인하세요`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '🚀 AI119 시작하기',
                    url: `https://t.me/${botUsername}?start=login`,
                  },
                ],
                [
                  { text: '🎯 미션', url: `${SITE}/missions` },
                  { text: '🏆 랭킹', url: `${SITE}/leaderboard` },
                ],
              ],
            },
          },
        );
      }
    });

    this.bot.on('message', async (ctx) => {
      if (ctx.chat?.type !== 'private') return;

      // Handle successful Telegram Stars payment
      const msg = ctx.message as unknown as Record<string, unknown>;
      if (msg.successful_payment) {
        const payment = msg.successful_payment as {
          total_amount: number;
          invoice_payload: string;
        };
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
            `✅ *Top-Up Complete!*\n\n` +
              `⭐ ${payment.total_amount} Stars → *${ap.toLocaleString()} AP* added to your wallet!\n` +
              `💰 Total value: $${(ap / 10000).toFixed(2)} USD`,
            { parse_mode: 'Markdown', reply_markup: this.mainKeyboard() },
          );
        } catch (err) {
          this.logger.error('Stars payment processing failed', err);
          await ctx.reply('Payment received but AP crediting failed. Please contact support.');
        }
        return;
      }

      const loginToken = this.authService.createBotLoginToken(String(ctx.from?.id), ctx.from);
      await ctx.reply(
        `Tap a button to get started 👇\n(or type /start to register)`,
        { reply_markup: this.mainKeyboard(loginToken) },
      );
    });
  }

  private async handleGetInvite(ctx: {
    from?: { id: number };
    reply: (text: string, extra?: Record<string, unknown>) => Promise<unknown>;
    telegram: Telegraf['telegram'];
  }) {
    const groupId = this.config.get<string>('TELEGRAM_GROUP_ID');
    if (!groupId) {
      await ctx.reply('⚠️ Group not configured. Contact the admin.');
      return;
    }

    const telegramId = String(ctx.from?.id);
    const user = (await this.usersService.findByTelegramId(telegramId)) as Record<string, unknown> | null;
    if (!user) {
      await ctx.reply('Please register first with /start');
      return;
    }

    const refCode = user.referralCode as string;
    let inviteLink = user.groupInviteLink as string | undefined;

    if (!inviteLink) {
      const created = await ctx.telegram.createChatInviteLink(groupId, {
        name: refCode,
        creates_join_request: true,
      });
      inviteLink = created.invite_link;
      await this.usersService.update(user.id as string, { groupInviteLink: inviteLink });
    }

    await ctx.reply(
      `🔗 *Your Personal Invite Link*\n\n` +
        `${inviteLink}\n\n` +
        `Anyone who joins via this link will be registered as your mentee!\n` +
        `💰 *1,000 AP* credited instantly for each new referral!`,
      { parse_mode: 'Markdown' },
    );
  }
}
