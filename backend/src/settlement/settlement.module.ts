import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SettlementService } from './settlement.service';
import { MissionsModule } from '../missions/missions.module';
import { FirebaseModule } from '../firebase/firebase.module';

@Module({
  imports: [ScheduleModule.forRoot(), MissionsModule, FirebaseModule],
  providers: [SettlementService],
})
export class SettlementModule {}
