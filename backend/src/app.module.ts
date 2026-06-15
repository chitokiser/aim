import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FirebaseModule } from './firebase/firebase.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MissionsModule } from './missions/missions.module';
import { PointsModule } from './points/points.module';
import { BotModule } from './bot/bot.module';
import { SettlementModule } from './settlement/settlement.module';
import { ListingsModule } from './listings/listings.module';
import { GroupJoinsModule } from './group-joins/group-joins.module';
import { RewardBotModule } from './reward-bot/reward-bot.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    FirebaseModule,
    AuthModule,
    UsersModule,
    MissionsModule,
    PointsModule,
    BotModule,
    SettlementModule,
    ListingsModule,
    GroupJoinsModule,
    RewardBotModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
