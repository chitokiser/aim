import { Module } from '@nestjs/common';
import { RewardBotService } from './reward-bot.service';
import { GroupJoinsModule } from '../../group-joins/group-joins.module';
import { AuthModule } from '../../auth/auth.module';
import { UsersModule } from '../../users/users.module';
import { PointsModule } from '../../points/points.module';

@Module({
  imports: [GroupJoinsModule, AuthModule, UsersModule, PointsModule],
  providers: [RewardBotService],
})
export class RewardBotModule {}
