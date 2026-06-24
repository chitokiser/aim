import { Module } from '@nestjs/common';
import { RewardBotService } from './reward-bot.service';
import { GroupJoinsModule } from '../../group-joins/group-joins.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [GroupJoinsModule, AuthModule],
  providers: [RewardBotService],
})
export class RewardBotModule {}
