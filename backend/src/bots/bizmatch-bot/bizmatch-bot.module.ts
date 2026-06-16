import { Module } from '@nestjs/common';
import { BizMatchBotService } from './bizmatch-bot.service';
import { FirebaseModule } from '../../firebase/firebase.module';

@Module({
  imports: [FirebaseModule],
  providers: [BizMatchBotService],
})
export class BizMatchBotModule {}
