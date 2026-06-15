import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { GroupJoinsService } from '../group-joins/group-joins.service';

@Injectable()
export class RewardBotService implements OnModuleInit {
  private readonly logger = new Logger(RewardBotService.name);
  private bot: Telegraf | null = null;

  constructor(private readonly groupJoins: GroupJoinsService) {}

  onModuleInit() {
    const token = process.env.REWARD_BOT_TOKEN;
    if (!token) {
      this.logger.warn('REWARD_BOT_TOKEN not set — ai119_reward_bot disabled');
      return;
    }

    this.bot = new Telegraf(token);
    this.registerHandlers();

    void this.bot.launch().then(() => {
      this.logger.log('ai119_reward_bot launched');
    }).catch((err: unknown) => {
      this.logger.error('ai119_reward_bot launch failed', err);
    });

    process.once('SIGINT', () => this.bot?.stop('SIGINT'));
    process.once('SIGTERM', () => this.bot?.stop('SIGTERM'));
  }

  private registerHandlers() {
    if (!this.bot) return;

    // New members joined advertiser group
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

    // Member left advertiser group
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

    // Bot added to a group — send setup confirmation
    this.bot.on('my_chat_member', async (ctx) => {
      const update = ctx.myChatMember;
      const newStatus = update.new_chat_member.status;
      if (newStatus === 'member' || newStatus === 'administrator') {
        const chatId = ctx.chat.id;
        await ctx.telegram.sendMessage(
          chatId,
          `✅ *AI119 Reward Bot 활성화*\n\n이 그룹의 회원 가입/퇴장을 모니터링합니다.\n광고주 미션의 그룹 ID: \`${chatId}\`\n\n이 ID를 AI119 광고주 페이지 → 그룹 가입 미션 → "그룹 ID" 항목에 입력하세요.`,
          { parse_mode: 'Markdown' },
        ).catch(() => {});
      }
    });
  }
}
