import { Module } from '@nestjs/common';
import { MainBotService } from './main-bot.service';
import { UsersModule } from '../../users/users.module';
import { MissionsModule } from '../../missions/missions.module';
import { AuthModule } from '../../auth/auth.module';
import { PointsModule } from '../../points/points.module';

@Module({
  imports: [UsersModule, MissionsModule, AuthModule, PointsModule],
  providers: [MainBotService],
})
export class MainBotModule {}
