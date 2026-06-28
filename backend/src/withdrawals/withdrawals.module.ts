import { Module } from '@nestjs/common';
import { WithdrawalsController } from './withdrawals.controller';
import { WithdrawalsService } from './withdrawals.service';
import { AuthModule } from '../auth/auth.module';
import { PointsModule } from '../points/points.module';

@Module({
  imports: [AuthModule, PointsModule],
  controllers: [WithdrawalsController],
  providers: [WithdrawalsService],
})
export class WithdrawalsModule {}
