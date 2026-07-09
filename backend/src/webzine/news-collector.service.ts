import { Injectable } from '@nestjs/common';
import Parser from 'rss-parser';

export interface CollectedArticle {
  title: string;
  link: string;
  pubDate: string;
  snippet: string;
}

@Injectable()
export class NewsCollectorService {
  private readonly parser = new Parser();

  async collect(query: string, limit = 12): Promise<CollectedArticle[]> {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
    const feed = await this.parser.parseURL(url);

    const seen = new Set<string>();
    const items: CollectedArticle[] = [];
    for (const entry of feed.items ?? []) {
      const title = (entry.title ?? '').trim();
      if (!title) continue;
      const key = title.slice(0, 40).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      items.push({
        title,
        link: entry.link ?? '',
        pubDate: entry.pubDate ?? '',
        snippet: (entry.contentSnippet ?? entry.content ?? '').slice(0, 400),
      });
      if (items.length >= limit) break;
    }
    return items;
  }
}
