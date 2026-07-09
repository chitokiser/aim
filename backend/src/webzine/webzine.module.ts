import { Module } from '@nestjs/common';
import { BlogModule } from '../blog/blog.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { NewsCollectorService } from './news-collector.service';
import { ArticleWriterService } from './article-writer.service';
import { ImageGeneratorService } from './image-generator.service';
import { StockImageService } from './stock-image.service';
import { KeywordResearchService } from './keyword-research.service';
import { WebzineConfigService } from './webzine-config.service';
import { WebzineSchedulerService } from './webzine-scheduler.service';
import { WebzineController } from './webzine.controller';

@Module({
  imports: [BlogModule, AuthModule, UsersModule],
  controllers: [WebzineController],
  providers: [
    NewsCollectorService,
    ArticleWriterService,
    ImageGeneratorService,
    StockImageService,
    KeywordResearchService,
    WebzineConfigService,
    WebzineSchedulerService,
  ],
})
export class WebzineModule {}
