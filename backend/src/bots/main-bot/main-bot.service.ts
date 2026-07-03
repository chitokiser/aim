import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { MissionsService } from '../../missions/missions.service';
import { AuthService } from '../../auth/auth.service';
import { PointsService } from '../../points/points.service';
import { LevelService } from '../../level/level.service';
import { BaseTelegrafBotService } from '../base/base-telegraf-bot.service';

const SITE = 'https://ai119.netlify.app';
const COMMUNITY = 'https://t.me/ai119link';
const STARS_TOPUP_EXP_RATE = 0.1; // 10% of credited AP is also granted as EXP

@Injectable()
export class MainBotService extends BaseTelegrafBotService {
  private readonly AP_PER_STAR = 130; // ~$0.013/Star (Fragment rate) · 77 Stars = 10,000 AP = $1
  private readonly STAR_PRESETS = [39, 77, 154, 385, 770];

  constructor(
    private config: ConfigService,
    private usersService: UsersService,
    private missionsService: MissionsService,
    private authService: AuthService,
    private pointsService: PointsService,
    private levelService: LevelService,
  ) {
    super();
  }

  protected getBotToken(): string | undefined {
    return this.config.get<string>('TELEGRAM_BOT_TOKEN');
  }

  // web_app buttons open directly without the "링크를 열까요?" confirmation — private chat only
  private mainKeyboard(loginToken?: string) {
    const q = loginToken ? `?tg=${loginToken}` : '';
    return {
      inline_keyboard: [
        [
          { text: '🚀 AI119 시작하기', web_app: { url: `${SITE}${q}` } },
          { text: '🔗 초대링크', callback_data: 'get_invite' },
        ],
        [
          { text: '🎯 미션', web_app: { url: `${SITE}/missions${q}` } },
          { text: '🏆 랭킹', web_app: { url: `${SITE}/leaderboard${q}` } },
        ],
        [
          { text: '⭐ AP 충전하기', callback_data: 'topup_menu' },
          { text: '💬 AI119 커뮤니티', url: COMMUNITY },
        ],
      ],
    };
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

  protected registerHandlers() {
    if (!this.bot) return;

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
              // t.me deep links open in-app without confirmation dialog
              inline_keyboard: [
                [{ text: '🚀 AI119 시작하기', url: `https://t.me/${botUsername}?start=login` }],
                [{ text: '💬 AI119 커뮤니티', url: COMMUNITY }],
              ],
            },
          },
        );
        return;
      }

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
                [{ text: '✅ AI119 로그인하기', web_app: { url: `${SITE}?tg=${loginToken}` } }],
              ],
            },
          },
        );
        return;
      }

      if (payload === 'mission') {
        await this.usersService.registerFromTelegram({
          telegramId: String(tg.id),
          firstName: tg.first_name,
          lastName: tg.last_name,
          username: tg.username,
        });
        const loginToken = this.authService.createBotLoginToken(String(tg.id), tg);
        await ctx.reply(
          `🎯 *AI119 미션*\n\n미션을 완료하고 AP를 획득하세요!\n💰 10,000 AP = $1 USD`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🎯 미션 시작하기', web_app: { url: `${SITE}/missions?tg=${loginToken}` } }],
              ],
            },
          },
        );
        return;
      }

      if (payload === 'rank') {
        await this.usersService.registerFromTelegram({
          telegramId: String(tg.id),
          firstName: tg.first_name,
          lastName: tg.last_name,
          username: tg.username,
        });
        const loginToken = this.authService.createBotLoginToken(String(tg.id), tg);
        await ctx.reply(
          `🏆 *AI119 랭킹*\n\nAP 적립 TOP 랭커들을 확인하세요!`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🏆 랭킹 보기', web_app: { url: `${SITE}/leaderboard?tg=${loginToken}` } }],
              ],
            },
          },
        );
        return;
      }

      // topup_X deep link from frontend Stars buttons  e.g. ?start=topup_100
      if (payload.startsWith('topup_')) {
        const { user } = await this.usersService.registerFromTelegram({
          telegramId: String(tg.id),
          firstName: tg.first_name,
          lastName: tg.last_name,
          username: tg.username,
        });
        const stars = parseInt(payload.replace('topup_', ''), 10);
        if (stars > 0 && this.STAR_PRESETS.includes(stars)) {
          await this.sendStarsInvoice(ctx, user as Record<string, unknown>, stars);
        } else {
          await ctx.reply(
            `⭐ *AP 충전 — Telegram Stars*\n\n환율: ⭐ 1 Star = *${this.AP_PER_STAR} AP* (10,000 AP = $1)\n\n충전할 Stars를 선택하세요:`,
            { parse_mode: 'Markdown', reply_markup: this.topupKeyboard() },
          );
        }
        return;
      }

      const refCode = (payload.startsWith('AIM') || payload.startsWith('AI119')) ? payload : undefined;

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
              [{ text: '🎯 Missions Page', web_app: { url: `${SITE}/missions?tg=${loginToken}` } }],
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
            [{ text: '📋 View All Missions', web_app: { url: `${SITE}/missions?tg=${loginToken}` } }],
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
            [{ text: '🏆 Full Leaderboard', web_app: { url: `${SITE}/leaderboard?tg=${loginToken}` } }],
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
              [{ text: '👤 View Profile', web_app: { url: `${SITE}/profile?tg=${loginToken}` } }],
              [{ text: '💸 Withdraw', web_app: { url: `${SITE}/profile?tg=${loginToken}` } }],
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
              [{ text: '💸 Withdraw', web_app: { url: `${SITE}/profile?tg=${loginToken}` } }],
            ],
          },
        },
      );
    });

    this.bot.command('wallet', async (ctx) => { await this.handleWalletCommand(ctx); });

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
              [{ text: '✅ AI119 로그인하기', web_app: { url: `${SITE}?tg=${loginToken}` } }],
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

    this.bot.on('chat_join_request', async (ctx) => {
      const req = ctx.update.chat_join_request;
      if (!req) return;

      const applicant = req.from;
      const chatId = req.chat.id;
      const linkName = req.invite_link?.name;

      const refCode = (linkName?.startsWith('AIM') || linkName?.startsWith('AI119')) ? linkName : undefined;

      const { user, isNew } = await this.usersService.registerFromTelegram({
        telegramId: String(applicant.id),
        firstName: applicant.first_name,
        lastName: applicant.last_name,
        username: applicant.username,
        refCode,
      });

      const userData = user as Record<string, unknown>;

      try {
        await ctx.telegram.approveChatJoinRequest(chatId, applicant.id);
      } catch (err) {
        const adminId = this.config.get<string>('ADMIN_TELEGRAM_ID');
        this.logger.error(`[JoinRequest] approveChatJoinRequest failed for ${applicant.id}`, err);
        if (adminId) {
          await ctx.telegram.sendMessage(
            adminId,
            `⚠️ *가입 승인 실패*\n\n` +
              `유저: ${applicant.first_name}${applicant.username ? ` (@${applicant.username})` : ''}\n` +
              `ID: ${applicant.id}\n\n` +
              `봇이 그룹 관리자 권한을 잃었거나 그룹 설정이 변경되었을 수 있습니다.\n` +
              `그룹에서 봇의 관리자 권한을 확인해주세요.`,
            { parse_mode: 'Markdown' },
          ).catch(() => {});
        }
        return;
      }

      const joinRewards = await this.missionsService.awardFollowJoin(String(applicant.id), chatId).catch(() => null);
      const rewardAP = joinRewards?.reduce((s, r) => s + r.reward, 0) ?? 0;

      // Always send a DM so the user gets a direct login button — critical for iOS users
      const loginToken = this.authService.createBotLoginToken(String(applicant.id), applicant);
      const bonusLine = rewardAP > 0 ? `\n🎁 가입 보상: *${rewardAP.toLocaleString()} AP* 지급완료!\n` : '\n';
      await ctx.telegram.sendMessage(
        applicant.id,
        `🎉 *${applicant.first_name}님, AI119에 오신 것을 환영합니다!*\n` +
          `${bonusLine}\n` +
          `아래 버튼을 눌러 AI119 플랫폼에 바로 로그인하세요 👇`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🚀 AI119 시작하기', web_app: { url: `${SITE}?tg=${loginToken}` } }],
              [{ text: '💬 AI119 커뮤니티', url: COMMUNITY }],
            ],
          },
        },
      ).catch(() => {});

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

        await this.missionsService.awardFollowJoin(String(member.id), ctx.chat.id).catch(() => {});

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
                  { text: '🎯 미션', url: `https://t.me/${botUsername}?start=mission` },
                  { text: '🏆 랭킹', url: `https://t.me/${botUsername}?start=rank` },
                ],
                [{ text: '💬 AI119 커뮤니티', url: COMMUNITY }],
              ],
            },
          },
        );
      }
    });

    this.bot.on('message', async (ctx) => {
      if (ctx.chat?.type !== 'private') return;

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
          const expBonus = Math.floor(ap * STARS_TOPUP_EXP_RATE);
          await this.levelService.awardExp(payload.userId, expBonus);
          await ctx.reply(
            `✅ *Top-Up Complete!*\n\n` +
              `⭐ ${payment.total_amount} Stars → *${ap.toLocaleString()} AP* added to your wallet!\n` +
              `✨ Bonus: *+${expBonus.toLocaleString()} EXP*\n` +
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

  private async handleWalletCommand(ctx: {
    chat?: { type: string };
    from?: { id: number };
    message: { text: string };
    reply: (text: string, extra?: Record<string, unknown>) => Promise<unknown>;
  }) {
    if (ctx.chat?.type !== 'private') return;
    const telegramId = String(ctx.from?.id);
    const user = (await this.usersService.findByTelegramId(telegramId)) as Record<string, unknown> | null;
    if (!user) {
      await ctx.reply('Please send /start to register first.');
      return;
    }

    const address = ctx.message.text.split(/\s+/)[1]?.trim();
    if (!address) {
      const current = user.tronWallet as string | undefined;
      await ctx.reply(
        current
          ? `💳 *Registered TRON wallet:*\n\`${current}\`\n\nTo change: \`/wallet <new address>\``
          : `💳 *Register your TRON wallet for USDT auto top-up:*\n\nUsage: \`/wallet <TRON address>\`\nExample: \`/wallet TXyz...\`\n\n_Address must start with T and be 34 characters long._`,
        { parse_mode: 'Markdown' },
      );
      return;
    }

    if (!address.startsWith('T') || address.length !== 34) {
      await ctx.reply('❌ Invalid TRON address. Must start with T and be 34 characters long.');
      return;
    }

    await this.usersService.update(user.id as string, { tronWallet: address });
    await ctx.reply(
      `✅ *TRON wallet registered!*\n\n\`${address}\`\n\nSend USDT (TRC20) from this address → AP will be credited automatically within 5 minutes.`,
      { parse_mode: 'Markdown' },
    );
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

  private async handleGetInvite(ctx: {
    from?: { id: number };
    reply: (text: string, extra?: Record<string, unknown>) => Promise<unknown>;
    telegram: NonNullable<typeof this.bot>['telegram'];
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
