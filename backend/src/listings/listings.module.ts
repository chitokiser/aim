import { Module } from '@nestjs/common';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { PointsModule } from '../points/points.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, PointsModule],
  controllers: [ListingsController],
  providers: [ListingsService],
})
export class ListingsModule {}
