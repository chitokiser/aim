import { Module } from '@nestjs/common';
import { MissionsController } from './missions.controller';
import { MissionsService } from './missions.service';
import { PointsModule } from '../points/points.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, PointsModule],
  controllers: [MissionsController],
  providers: [MissionsService],
  exports: [MissionsService],
})
export class MissionsModule {}
