import { Module } from '@nestjs/common';
import { AdminTagsController } from './admin-tags.controller';
import { AdminStatsController } from './admin-stats.controller';
import { AdminNoticeController } from './admin-notice.controller';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [UsersModule, AuthModule],
  controllers: [AdminTagsController, AdminStatsController, AdminNoticeController],
})
export class AdminModule {}
