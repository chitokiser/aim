import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FirebaseModule } from './firebase/firebase.module';
import { AiBudgetModule } from './common/ai-budget.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MissionsModule } from './missions/missions.module';
import { PointsModule } from './points/points.module';
import { SettlementModule } from './settlement/settlement.module';
import { ListingsModule } from './listings/listings.module';
import { CreativeListingsModule } from './creative-listings/creative-listings.module';
import { GroupJoinsModule } from './group-joins/group-joins.module';
import { MainBotModule } from './bots/main-bot/main-bot.module';
import { RewardBotModule } from './bots/reward-bot/reward-bot.module';
import { BizMatchBotModule } from './bots/bizmatch-bot/bizmatch-bot.module';
import { AuctionModule } from './auction/auction.module';
import { AdminModule } from './admin/admin.module';
import { TopupModule } from './topup/topup.module';
import { TtsModule } from './tts/tts.module';
import { MusicVideoModule } from './music-video/music-video.module';
import { MusicGenModule } from './music-gen/music-gen.module';
import { CpxModule } from './cpx/cpx.module';
import { WithdrawalsModule } from './withdrawals/withdrawals.module';
import { OfferwallModule } from './offerwall/offerwall.module';
import { PaymentwallModule } from './paymentwall/paymentwall.module';
import { EarnwallModule } from './earnwall/earnwall.module';
import { CoupangModule } from './coupang/coupang.module';
import { LinkpriceModule } from './linkprice/linkprice.module';
import { CjShopModule } from './cj-shop/cj-shop.module';
import { LevelModule } from './level/level.module';
import { RouletteModule } from './roulette/roulette.module';
import { BlogModule } from './blog/blog.module';
import { WebzineModule } from './webzine/webzine.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    FirebaseModule,
    AiBudgetModule,
    AuthModule,
    UsersModule,
    MissionsModule,
    PointsModule,
    SettlementModule,
    ListingsModule,
    CreativeListingsModule,
    GroupJoinsModule,
    MainBotModule,
    RewardBotModule,
    BizMatchBotModule,
    AuctionModule,
    AdminModule,
    TopupModule,
    TtsModule,
    MusicVideoModule,
    MusicGenModule,
    CpxModule,
    WithdrawalsModule,
    OfferwallModule,
    PaymentwallModule,
    EarnwallModule,
    CoupangModule,
    LinkpriceModule,
    CjShopModule,
    LevelModule,
    RouletteModule,
    BlogModule,
    WebzineModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
