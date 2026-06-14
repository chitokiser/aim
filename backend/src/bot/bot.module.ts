import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { UsersModule } from '../users/users.module';
import { MissionsModule } from '../missions/missions.module';

@Module({
  imports: [UsersModule, MissionsModule],
  providers: [BotService],
})
export class BotModule {}
