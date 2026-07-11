import { Module } from '@nestjs/common';
import { BlogController } from './blog.controller';
import { BlogService } from './blog.service';
import { IndexNowService } from './indexnow.service';
import { BloggerService } from './blogger.service';
import { BloggerSchedulerService } from './blogger-scheduler.service';
import { WordPressService } from './wordpress.service';
import { WordPressSchedulerService } from './wordpress-scheduler.service';
import { TumblrService } from './tumblr.service';
import { FacebookService } from './facebook.service';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { RouletteModule } from '../roulette/roulette.module';

@Module({
  imports: [AuthModule, UsersModule, RouletteModule],
  controllers: [BlogController],
  providers: [
    BlogService,
    IndexNowService,
    BloggerService,
    BloggerSchedulerService,
    WordPressService,
    WordPressSchedulerService,
    TumblrService,
    FacebookService,
  ],
  exports: [
    BlogService,
    IndexNowService,
    BloggerService,
    BloggerSchedulerService,
    WordPressService,
    WordPressSchedulerService,
    TumblrService,
    FacebookService,
  ],
})
export class BlogModule {}
