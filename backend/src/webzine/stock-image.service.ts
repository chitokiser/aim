import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface PixabayHit {
  largeImageURL: string;
  webformatURL: string;
}

interface PixabayResponse {
  hits: PixabayHit[];
}

// Wraps the Pixabay API (https://pixabay.com/api/docs/) — free, no
// attribution required, licensed for commercial reuse. Used as the first
// choice for cover images (real photos of real subjects: factories,
// excavators, ports, etc.) since it doesn't consume the Imagen daily quota
// and is often more accurate/credible than an AI illustration for these
// factual reference topics. Only supports English query terms.
@Injectable()
export class StockImageService {
  private readonly logger = new Logger(StockImageService.name);
  private readonly apiKey?: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('PIXABAY_API_KEY');
  }

  private isConfigured(): boolean {
    return Boolean(this.apiKey) && this.apiKey !== 'your-pixabay-api-key';
  }

  async searchPhoto(query: string): Promise<string | null> {
    if (!this.isConfigured() || !query?.trim()) return null;

    try {
      const params = new URLSearchParams({
        key: this.apiKey as string,
        q: query.trim().slice(0, 100),
        image_type: 'photo',
        orientation: 'horizontal',
        safesearch: 'true',
        per_page: '15',
      });
      const res = await fetch(`https://pixabay.com/api/?${params.toString()}`);
      if (!res.ok) {
        this.logger.warn(`Pixabay search failed (${res.status}) for "${query}"`);
        return null;
      }
      const data = (await res.json()) as PixabayResponse;
      if (!data.hits?.length) return null;
      // Picking randomly among the top matches (rather than always the #1
      // result) avoids every article with a similar imageQuery landing on
      // the exact same photo.
      const hit = data.hits[Math.floor(Math.random() * data.hits.length)];
      return hit?.largeImageURL ?? hit?.webformatURL ?? null;
    } catch (err) {
      this.logger.warn(`Pixabay search error for "${query}": ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }
}
