import { Module } from '@nestjs/common';
import { PaymentwallController } from './paymentwall.controller';
import { AuthModule } from '../auth/auth.module';
import { FirebaseModule } from '../firebase/firebase.module';
import { PointsModule } from '../points/points.module';

@Module({
  imports: [AuthModule, FirebaseModule, PointsModule],
  controllers: [PaymentwallController],
})
export class PaymentwallModule {}
