import { Module } from '@nestjs/common';
import { CreativeListingsController } from './creative-listings.controller';
import { CreativeListingsService } from './creative-listings.service';
import { PointsModule } from '../points/points.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, PointsModule],
  controllers: [CreativeListingsController],
  providers: [CreativeListingsService],
})
export class CreativeListingsModule {}
