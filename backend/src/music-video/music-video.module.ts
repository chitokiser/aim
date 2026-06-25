import { Module } from '@nestjs/common';
import { MusicVideoController } from './music-video.controller';
import { MusicVideoService } from './music-video.service';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [MusicVideoController],
  providers: [MusicVideoService],
})
export class MusicVideoModule {}
