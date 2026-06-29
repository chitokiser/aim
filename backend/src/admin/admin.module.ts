import { Module } from '@nestjs/common';
import { AdminTagsController } from './admin-tags.controller';
import { AdminStatsController } from './admin-stats.controller';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [UsersModule, AuthModule],
  controllers: [AdminTagsController, AdminStatsController],
})
export class AdminModule {}
