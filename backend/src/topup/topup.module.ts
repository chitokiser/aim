import { Module } from '@nestjs/common';
import { TonMonitorService } from './ton-monitor.service';
import { UsdtMonitorService } from './usdt-monitor.service';
import { FirebaseModule } from '../firebase/firebase.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [FirebaseModule, UsersModule],
  providers: [TonMonitorService, UsdtMonitorService],
})
export class TopupModule {}
