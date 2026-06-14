import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, Context } from 'telegraf';
import { UsersService } from '../users/users.service';
import { MissionsService } from '../missions/missions.service';

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

  private registerCommands() {
    this.bot.command('start', async (ctx) => {
      const miniAppUrl = this.config.get('MINI_APP_URL') ?? 'https://t.me/AIMBot/app';
      const refCode = ctx.message.text.split(' ')[1] ?? '';
      const authUrl = `${this.config.get('FRONTEND_URL') ?? 'https://aim.example.com'}/auth${refCode ? `?ref=${refCode}` : ''}`;

      await ctx.reply(
        `🎯 *AIM - AI Money Makers Hub*\n\n` +
          `AI 콘텐츠를 만들고 AIM Point(AP)를 받아 TON코인으로 환전하세요!\n\n` +
          `📱 미니앱에서 시작하거나 아래 링크로 가입하세요.`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🚀 AIM 앱 열기', web_app: { url: miniAppUrl } }],
              [{ text: '🔗 웹에서 가입', url: authUrl }],
            ],
          },
        },
      );
    });

    this.bot.command('mission', async (ctx) => {
      const missions = await this.missionsService.findAll('active');
      if (missions.length === 0) {
        await ctx.reply('현재 진행 중인 미션이 없습니다.');
        return;
      }

      const list = missions
        .slice(0, 5)
        .map((m: Record<string, unknown>, i: number) => `${i + 1}. *${m.title}* — ${(m.reward as number).toLocaleString()} AP`)
        .join('\n');

      await ctx.reply(`🎯 *현재 미션 목록*\n\n${list}`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 전체 미션 보기', url: `${this.config.get('FRONTEND_URL')}/missions` }],
          ],
        },
      });
    });

    this.bot.command('rank', async (ctx) => {
      const board = await this.usersService.getLeaderboard('all');
      const top5 = board.slice(0, 5);
      const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
      const list = top5
        .map((u: Record<string, unknown>, i: number) => `${medals[i]} ${u.firstName} — ${(u.points as number).toLocaleString()} AP`)
        .join('\n');

      await ctx.reply(`🏆 *TOP 5 랭킹*\n\n${list}`, { parse_mode: 'Markdown' });
    });

    this.bot.command('reward', async (ctx) => {
      const telegramId = String(ctx.from?.id);
      const user = await this.usersService.findByTelegramId(telegramId) as Record<string, unknown> | null;
      if (!user) {
        await ctx.reply('먼저 /start 로 가입해주세요.');
        return;
      }

      const points = user.points as number;
      const usd = (points / 10000).toFixed(2);
      await ctx.reply(
        `💰 *출금 정보*\n\n보유 AP: *${points.toLocaleString()}*\n출금 가능: *${usd} USD*\n\n` +
          `최소 출금: 50,000 AP (5 USD)\n교환비: 10,000 AP = 1 USD`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '💸 출금하기', url: `${this.config.get('FRONTEND_URL')}/profile` }],
            ],
          },
        },
      );
    });

    this.bot.command('profile', async (ctx) => {
      const telegramId = String(ctx.from?.id);
      const user = await this.usersService.findByTelegramId(telegramId) as Record<string, unknown> | null;
      if (!user) {
        await ctx.reply('먼저 /start 로 가입해주세요.');
        return;
      }

      const points = user.points as number;
      await ctx.reply(
        `👤 *내 프로필*\n\n` +
          `이름: ${user.firstName}\n` +
          `포인트: *${points.toLocaleString()} AP*\n` +
          `USD 환산: ${(points / 10000).toFixed(2)} USD\n` +
          `추천코드: \`${user.referralCode}\``,
        { parse_mode: 'Markdown' },
      );
    });
  }
}
