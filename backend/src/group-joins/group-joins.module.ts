import { Module } from '@nestjs/common';
import { GroupJoinsService } from './group-joins.service';
import { GroupJoinsController } from './group-joins.controller';
import { PointsModule } from '../points/points.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, PointsModule],
  controllers: [GroupJoinsController],
  providers: [GroupJoinsService],
  exports: [GroupJoinsService],
})
export class GroupJoinsModule {}
