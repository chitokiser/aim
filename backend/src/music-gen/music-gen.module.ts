import { Module } from '@nestjs/common';
import { MusicGenService } from './music-gen.service';
import { MusicGenController } from './music-gen.controller';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [AuthModule, UsersModule],
  providers: [MusicGenService],
  controllers: [MusicGenController],
})
export class MusicGenModule {}
