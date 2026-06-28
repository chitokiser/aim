import { Module } from '@nestjs/common';
import { CpxController } from './cpx.controller';
import { AuthModule } from '../auth/auth.module';
import { PointsModule } from '../points/points.module';

@Module({
  imports: [AuthModule, PointsModule],
  controllers: [CpxController],
})
export class CpxModule {}
