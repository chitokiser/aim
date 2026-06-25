import { Module } from '@nestjs/common';
import { TtsController } from './tts.controller';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [TtsController],
})
export class TtsModule {}
