import { Module } from '@nestjs/common';
import { MusicGenService } from './music-gen.service';
import { MusicGenController } from './music-gen.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  providers: [MusicGenService],
  controllers: [MusicGenController],
})
export class MusicGenModule {}
