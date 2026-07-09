import { Module } from '@nestjs/common';
import { BlogController } from './blog.controller';
import { BlogService } from './blog.service';
import { IndexNowService } from './indexnow.service';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { RouletteModule } from '../roulette/roulette.module';

@Module({
  imports: [AuthModule, UsersModule, RouletteModule],
  controllers: [BlogController],
  providers: [BlogService, IndexNowService],
  exports: [BlogService, IndexNowService],
})
export class BlogModule {}
