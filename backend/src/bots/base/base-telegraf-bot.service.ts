import { Logger, OnModuleInit } from '@nestjs/common';
import { Telegraf } from 'telegraf';

/**
 * All Telegram bots in this project extend this class.
 * Subclasses must implement:
 *   getBotToken()      — returns the token from env/config
 *   registerHandlers() — attaches all bot.on / bot.command listeners
 *
 * The base class handles: token check, Telegraf init, launch, SIGINT/SIGTERM.
 */
export abstract class BaseTelegrafBotService implements OnModuleInit {
  protected readonly logger = new Logger(this.constructor.name);
  protected bot: Telegraf | null = null;

  async onModuleInit() {
    const token = this.getBotToken();
    if (!token) {
      this.logger.warn(`Bot token not set — ${this.constructor.name} disabled`);
      return;
    }
    try {
      this.bot = new Telegraf(token);
      this.registerHandlers();
      void this.bot.launch().then(() => {
        this.logger.log(`${this.constructor.name} launched`);
      }).catch((err: unknown) => {
        this.logger.error('Bot launch failed', err);
      });
      process.once('SIGINT', () => this.bot?.stop('SIGINT'));
      process.once('SIGTERM', () => this.bot?.stop('SIGTERM'));
    } catch (err) {
      this.logger.error(`${this.constructor.name} initialization failed`, err);
    }
  }

  protected abstract getBotToken(): string | undefined;
  protected abstract registerHandlers(): void;
}
