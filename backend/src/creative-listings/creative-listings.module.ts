import { Module } from '@nestjs/common';
import { CreativeListingsController } from './creative-listings.controller';
import { CreativeListingsService } from './creative-listings.service';
import { PointsModule } from '../points/points.module';
import { AuthModule } from '../auth/auth.module';
import { LevelModule } from '../level/level.module';

@Module({
  imports: [AuthModule, PointsModule, LevelModule],
  controllers: [CreativeListingsController],
  providers: [CreativeListingsService],
})
export class CreativeListingsModule {}
