import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuthModule } from '../auth/auth.module';
import { PointsModule } from '../points/points.module';
import { LevelModule } from '../level/level.module';

@Module({
  imports: [AuthModule, PointsModule, LevelModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
