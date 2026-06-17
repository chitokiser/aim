import { Module } from '@nestjs/common';
import { AuctionController } from './auction.controller';
import { AuctionService } from './auction.service';
import { PointsModule } from '../points/points.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, PointsModule],
  controllers: [AuctionController],
  providers: [AuctionService],
})
export class AuctionModule {}
