import { Controller, Get } from '@nestjs/common';
import { TrendingKeywordsService } from './trending-keywords.service';

@Controller('blog')
export class TrendingKeywordsController {
  constructor(private readonly trending: TrendingKeywordsService) {}

  @Get('trending-keywords')
  async getTrending() {
    return this.trending.getTrending();
  }
}
