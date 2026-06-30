import { Module } from '@nestjs/common';
import { EarnwallController } from './earnwall.controller';
import { FirebaseModule } from '../firebase/firebase.module';
import { PointsModule } from '../points/points.module';

@Module({
  imports: [FirebaseModule, PointsModule],
  controllers: [EarnwallController],
})
export class EarnwallModule {}
