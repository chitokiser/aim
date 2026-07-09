import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateText, extractJSON, hasAiProvider, type AiKeys } from '../common/ai-text.util';
import type { CategoryDef } from './webzine.constants';

@Injectable()
export class KeywordResearchService {
  private readonly logger = new Logger(KeywordResearchService.name);
  private readonly aiKeys: AiKeys;

  constructor(private readonly config: ConfigService) {
    this.aiKeys = {
      geminiKey: this.config.get<string>('GEMINI_API_KEY'),
      anthropicKey: this.config.get<string>('ANTHROPIC_API_KEY'),
    };
  }

  // Returns up to `count` ranked, currently-trending search keywords for a
  // category — run once per category per daily batch so that day's news
  // collection follows real trending topics instead of a single static
  // category query. Falls back to the category's default query on failure.
  async rankKeywords(category: CategoryDef, count: number): Promise<string[]> {
    if (count <= 0) return [];
    if (!hasAiProvider(this.aiKeys)) return [category.searchQuery];

    const prompt = `You are a news trend analyst for the "${category.ko}" (${category.en}) section of a Korean AI web magazine.

List the ${count} most newsworthy, currently-trending search keywords or short phrases in Korean for this category right now — ranked from most to least important. Each one should be specific enough to search Google News and find a real, current story (not a generic single word like "정치").

Return ONLY a valid JSON array of ${count} strings, ranked by importance, no markdown fences:
["keyword 1", "keyword 2", ...]`;

    try {
      const text = await generateText(this.aiKeys, prompt, 1024);
      const keywords: unknown = JSON.parse(extractJSON(text));
      if (!Array.isArray(keywords) || keywords.length === 0) return [category.searchQuery];
      return keywords.map((k) => String(k)).slice(0, count);
    } catch (err) {
      this.logger.warn(
        `Keyword ranking failed for ${category.slug}, falling back to default query: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [category.searchQuery];
    }
  }
}
