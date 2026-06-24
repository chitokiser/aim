import { Injectable } from '@nestjs/common';
import { GroupJoinsService } from '../../group-joins/group-joins.service';
import { BaseTelegrafBotService } from '../base/base-telegraf-bot.service';
import { AuthService } from '../../auth/auth.service';
import { Markup } from 'telegraf';

const SITE = 'https://ai119.netlify.app';
const COMMUNITY = 'https://t.me/ai119link';

@Injectable()
export class RewardBotService extends BaseTelegrafBotService {
  constructor(
    private readonly groupJoins: GroupJoinsService,
    private readonly authService: AuthService,
  ) {
    super();
  }

  protected getBotToken(): string | undefined {
    return process.env.REWARD_BOT_TOKEN;
  }

  protected registerHandlers() {
    if (!this.bot) return;

    this.bot.command('start', async (ctx) => {
      const chat = ctx.chat;
      const user = ctx.from;
      const isPrivate = chat.type === 'private';

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
