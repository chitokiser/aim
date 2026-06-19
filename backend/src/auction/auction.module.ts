import { Module } from '@nestjs/common';
import { AuctionController } from './auction.controller';
import { AuctionService } from './auction.service';
import { PointsModule } from '../points/points.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [AuthModule, PointsModule, UsersModule],
  controllers: [AuctionController],
  providers: [AuctionService],
})
export class AuctionModule {}
