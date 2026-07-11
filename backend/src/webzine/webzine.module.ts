import { Module } from '@nestjs/common';
import { BlogModule } from '../blog/blog.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { NewsCollectorService } from './news-collector.service';
import { ArticleWriterService } from './article-writer.service';
import { ImageGeneratorService } from './image-generator.service';
import { StockImageService } from './stock-image.service';
import { PexelsService } from './pexels.service';
import { KeywordResearchService } from './keyword-research.service';
import { WebzineConfigService } from './webzine-config.service';
import { WebzineSchedulerService } from './webzine-scheduler.service';
import { WebzineController } from './webzine.controller';
import { TrendingKeywordsService } from './trending-keywords.service';
import { TrendingKeywordsController } from './trending-keywords.controller';
import { TrendingArticleService } from './trending-article.service';
import { ClassicsAutoSeedService } from './classics-auto-seed.service';
import { WordPressTrendingWidgetService } from './wordpress-trending-widget.service';
import { SilverAiBootcampService } from './silver-ai-bootcamp.service';

@Module({
  imports: [BlogModule, AuthModule, UsersModule],
  controllers: [WebzineController, TrendingKeywordsController],
  providers: [
    NewsCollectorService,
    ArticleWriterService,
    ImageGeneratorService,
    StockImageService,
    PexelsService,
    KeywordResearchService,
    WebzineConfigService,
    WebzineSchedulerService,
    TrendingKeywordsService,
    TrendingArticleService,
    ClassicsAutoSeedService,
    WordPressTrendingWidgetService,
    SilverAiBootcampService,
  ],
})
export class WebzineModule {}
