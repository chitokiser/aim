import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';
import { UsersService } from '../users/users.service';
import { MissionsService } from '../missions/missions.service';

const SITE = 'https://ai119.netlify.app';

@Injectable()
export class BotService implements OnModuleInit {
  private readonly logger = new Logger(BotService.name);
  private bot: Telegraf;

  constructor(
    private config: ConfigService,
    private usersService: UsersService,
    private missionsService: MissionsService,
  ) {}

  async onModuleInit() {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set — bot disabled');
      return;
    }

    this.bot = new Telegraf(token);
    this.registerCommands();

    this.bot.launch().catch((err) => this.logger.error('Bot launch failed', err));
    this.logger.log('Telegram bot started');
  }

  private mainKeyboard() {
    return {
      inline_keyboard: [
        [{ text: '🚀 AI119 시작하기', url: SITE }],
        [
          { text: '🎯 미션시작', url: `${SITE}/missions` },
          { text: '🏆 랭킹', url: `${SITE}/leaderboard` },
        ],
      ],
    };
  }

  private registerCommands() {
    // /start — auto-register + show main menu
    this.bot.command('start', async (ctx) => {
      const tg = ctx.from;
      const refCode = ctx.message.text.split(' ')[1] ?? '';

      const { user, isNew } = await this.usersService.registerFromTelegram({
        telegramId: String(tg.id),
        firstName: tg.first_name,
        lastName: tg.last_name,
        username: tg.username,
        refCode: refCode || undefined,
      });

      const userData = user as Record<string, unknown>;
      const greeting = isNew
        ? `🎉 *환영합니다, ${tg.first_name}님!*\n\n✅ 회원가입 완료!\n🔗 추천코드: \`${userData.referralCode}\`\n👨‍🏫 멘토 연결: ${userData.mentorId ? '완료 ✅' : '없음'}\n\n`
        : `👋 *다시 오셨군요, ${tg.first_name}님!*\n\n`;

      await ctx.reply(
        `${greeting}` +
          `🎯 *AI119 — AI 콘텐츠로 돈 버는 플랫폼*\n\n` +
          `📌 미션을 완료하고 AP(AimPoint)를 적립하세요.\n` +
          `💰 10,000 AP = 1 USD (TON/USDT 출금 가능)\n\n` +
          `아래 버튼을 눌러 시작하세요! 👇`,
        {
          parse_mode: 'Markdown',
          reply_markup: this.mainKeyboard(),
        },
      );
    });

    // /menu — 메인 메뉴 다시 보기
    this.bot.command('menu', async (ctx) => {
      await ctx.reply(
        `📋 *AI119 메인 메뉴*`,
        {
          parse_mode: 'Markdown',
          reply_markup: this.mainKeyboard(),
        },
      );
    });

    // /mission — 현재 미션 목록
    this.bot.command('mission', async (ctx) => {
      const missions = await this.missionsService.findAll('active');
      if (missions.length === 0) {
        await ctx.reply('현재 진행 중인 미션이 없습니다.', {
          reply_markup: {
            inline_keyboard: [[{ text: '🎯 미션 페이지', url: `${SITE}/missions` }]],
          },
        });
        return;
      }

      const list = missions
        .slice(0, 5)
        .map((m: Record<string, unknown>, i: number) =>
          `${i + 1}. *${m.title}* — ${(m.reward as number).toLocaleString()} AP`,
        )
        .join('\n');

      await ctx.reply(`🎯 *진행 중인 미션*\n\n${list}`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 전체 미션 보기', url: `${SITE}/missions` }],
          ],
        },
      });
    });

    // /rank — TOP 5 랭킹
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

      await ctx.reply(`🏆 *TOP 5 랭킹*\n\n${list}`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '🏆 전체 랭킹 보기', url: `${SITE}/leaderboard` }]],
        },
      });
    });

    // /profile — 내 정보
    this.bot.command('profile', async (ctx) => {
      const telegramId = String(ctx.from?.id);
      const user = (await this.usersService.findByTelegramId(telegramId)) as Record<string, unknown> | null;
      if (!user) {
        await ctx.reply('먼저 /start 로 가입해주세요.');
        return;
      }

      const points = user.points as number;
      await ctx.reply(
        `👤 *내 프로필*\n\n` +
          `이름: ${user.firstName}\n` +
          `포인트: *${points.toLocaleString()} AP*\n` +
          `USD 환산: $${(points / 10000).toFixed(2)}\n` +
          `추천코드: \`${user.referralCode}\`\n` +
          `멘토: ${user.mentorId ? '연결됨 ✅' : '없음'}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '👤 내 프로필 보기', url: `${SITE}/profile` }],
              [{ text: '💸 출금하기', url: `${SITE}/profile` }],
            ],
          },
        },
      );
    });

    // /reward — AP / 출금 정보
    this.bot.command('reward', async (ctx) => {
      const telegramId = String(ctx.from?.id);
      const user = (await this.usersService.findByTelegramId(telegramId)) as Record<string, unknown> | null;
      if (!user) {
        await ctx.reply('먼저 /start 로 가입해주세요.');
        return;
      }

      const points = user.points as number;
      await ctx.reply(
        `💰 *출금 정보*\n\n` +
          `보유 AP: *${points.toLocaleString()} AP*\n` +
          `출금 가능: *$${(points / 10000).toFixed(2)} USD*\n\n` +
          `최소 출금: 50,000 AP (= $5)\n` +
          `교환비: 10,000 AP = $1 USD`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '💸 출금하기', url: `${SITE}/profile` }]],
          },
        },
      );
    });

    // 등록되지 않은 메시지 → 메인 메뉴 유도
    this.bot.on('message', async (ctx) => {
      await ctx.reply(
        `아래 버튼을 눌러 AI119를 시작하세요 👇\n(/start 를 입력하면 가입할 수 있어요)`,
        { reply_markup: this.mainKeyboard() },
      );
    });
  }
}
