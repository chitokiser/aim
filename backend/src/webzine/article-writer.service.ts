import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import type { CollectedArticle } from './news-collector.service';
import type { CategoryDef } from './webzine.constants';
import type { BlogSource } from '../blog/blog.service';

export interface WrittenArticle {
  title: string;
  excerpt: string;
  content: string;
  keyPoints: string[];
  tags: string[];
  sources: BlogSource[];
}

@Injectable()
export class ArticleWriterService {
  private anthropic: Anthropic | null = null;
  private readonly model = 'claude-opus-4-8';

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('ANTHROPIC_API_KEY');
    if (key && key !== 'your-anthropic-api-key') {
      this.anthropic = new Anthropic({ apiKey: key });
    }
  }

  private extractJSON(text: string): string {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    return match ? match[1].trim() : text.trim();
  }

  async write(category: CategoryDef, articles: CollectedArticle[]): Promise<WrittenArticle | null> {
    if (!this.anthropic) throw new BadRequestException('AI writer is not configured');
    if (articles.length === 0) return null;

    const sourceList = articles
      .map((a, i) => `${i + 1}. ${a.title}\n   ${a.snippet}\n   URL: ${a.link}`)
      .join('\n\n');

    const prompt = `You are a professional Korean news editor writing for the "${category.ko}" (${category.en}) section of AI119, a Korean AI commerce web magazine.

Below are today's raw headlines and snippets collected from public RSS feeds:

${sourceList}

Task:
- Pick the single most newsworthy, non-duplicate story from the list above (or synthesize a short roundup if several items cover the same event).
- Write an ORIGINAL Korean-language article in your own words. Never copy sentences verbatim from the snippets.
- State only facts supported by the source material above. Do not invent quotes, numbers, or events not present in the sources.
- Structure: an engaging title, a 1-2 sentence excerpt (under 160 characters), and a full body as HTML using only <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>, <a> tags (at least 3 sections, 1500-3000 Korean characters total), 3-5 short bullet "key points", and 3-6 SEO tags.
- Note which of the numbered sources above you actually drew from, by their index numbers.

Return ONLY valid JSON, no markdown fences:
{"title": "...", "excerpt": "...", "content": "<h2>...</h2><p>...</p>", "keyPoints": ["...", "..."], "tags": ["...", "..."], "usedSourceIndexes": [1, 3]}`;

    try {
      const resp = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = resp.content[0].type === 'text' ? resp.content[0].text : '{}';
      const draft = JSON.parse(this.extractJSON(text)) as Record<string, unknown>;

      const usedIndexes = Array.isArray(draft.usedSourceIndexes)
        ? (draft.usedSourceIndexes as unknown[]).map((n) => Number(n))
        : [];
      let sources: BlogSource[] = usedIndexes
        .map((i) => articles[i - 1])
        .filter((a): a is CollectedArticle => Boolean(a))
        .map((a) => ({ title: a.title, url: a.link }));
      if (sources.length === 0) {
        sources = articles.slice(0, 3).map((a) => ({ title: a.title, url: a.link }));
      }

      return {
        title: String(draft.title ?? ''),
        excerpt: String(draft.excerpt ?? ''),
        content: String(draft.content ?? ''),
        keyPoints: Array.isArray(draft.keyPoints) ? draft.keyPoints.map((k) => String(k)) : [],
        tags: Array.isArray(draft.tags) ? draft.tags.map((tg) => String(tg)) : [],
        sources,
      };
    } catch {
      throw new BadRequestException('Failed to generate webzine article');
    }
  }
}
