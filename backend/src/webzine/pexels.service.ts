import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface PexelsPhoto {
  src: { original: string; large2x: string; large: string; medium: string };
}

interface PexelsResponse {
  photos: PexelsPhoto[];
}

// Wraps the Pexels API (https://www.pexels.com/api/documentation/) — free,
// no attribution required, licensed for commercial reuse. Tried first for
// cover images (real photos of real subjects: factories, excavators, ports,
// etc.) since it doesn't consume the Imagen daily quota and is often more
// accurate/credible than an AI illustration for factual reference topics.
// Only supports English query terms.
@Injectable()
export class PexelsService {
  private readonly logger = new Logger(PexelsService.name);
  private readonly apiKey?: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('PEXELS_API_KEY');
  }

  private isConfigured(): boolean {
    return Boolean(this.apiKey) && this.apiKey !== 'your-pexels-api-key';
  }

  async searchPhoto(query: string): Promise<string | null> {
    if (!this.isConfigured() || !query?.trim()) return null;

    try {
      const params = new URLSearchParams({
        query: query.trim().slice(0, 100),
        per_page: '15',
        orientation: 'landscape',
      });
      const res = await fetch(`https://api.pexels.com/v1/search?${params.toString()}`, {
        headers: { Authorization: this.apiKey as string },
      });
      if (!res.ok) {
        this.logger.warn(`Pexels search failed (${res.status}) for "${query}"`);
        return null;
      }
      const data = (await res.json()) as PexelsResponse;
      if (!data.photos?.length) return null;
      // Picking randomly among the top matches (rather than always the #1
      // result) avoids every article with a similar imageQuery landing on
      // the exact same photo.
      const photo = data.photos[Math.floor(Math.random() * data.photos.length)];
      return photo?.src?.large2x ?? photo?.src?.large ?? photo?.src?.original ?? null;
    } catch (err) {
      this.logger.warn(`Pexels search error for "${query}": ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }
}
