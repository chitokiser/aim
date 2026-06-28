import { Module } from '@nestjs/common';
import { AdgemController } from './adgem.controller';
import { AuthModule } from '../auth/auth.module';
import { FirebaseModule } from '../firebase/firebase.module';
import { PointsModule } from '../points/points.module';

@Module({
  imports: [AuthModule, FirebaseModule, PointsModule],
  controllers: [AdgemController],
})
export class AdgemModule {}
