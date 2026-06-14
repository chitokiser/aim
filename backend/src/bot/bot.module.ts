import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { UsersModule } from '../users/users.module';
import { MissionsModule } from '../missions/missions.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [UsersModule, MissionsModule, AuthModule],
  providers: [BotService],
})
export class BotModule {}
