import { Module } from '@nestjs/common';
import { RewardBotService } from './reward-bot.service';
import { GroupJoinsModule } from '../group-joins/group-joins.module';

@Module({
  imports: [GroupJoinsModule],
  providers: [RewardBotService],
})
export class RewardBotModule {}
