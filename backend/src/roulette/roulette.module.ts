import { Module } from '@nestjs/common';
import { RouletteController } from './roulette.controller';
import { RouletteService } from './roulette.service';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { LevelModule } from '../level/level.module';

@Module({
  imports: [AuthModule, UsersModule, LevelModule],
  controllers: [RouletteController],
  providers: [RouletteService],
  exports: [RouletteService],
})
export class RouletteModule {}
