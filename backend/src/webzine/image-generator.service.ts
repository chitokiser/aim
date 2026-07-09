import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { FirebaseService } from '../firebase/firebase.service';
import { StockImageService } from './stock-image.service';
import { PexelsService } from './pexels.service';

const IMAGE_MODEL = 'imagen-4.0-generate-001';

@Injectable()
export class ImageGeneratorService {
  private readonly logger = new Logger(ImageGeneratorService.name);
  private readonly geminiKey?: string;

  constructor(
    private readonly config: ConfigService,
    private readonly firebase: FirebaseService,
    private readonly stockImages: StockImageService,
    private readonly pexels: PexelsService,
  ) {
    this.geminiKey = this.config.get<string>('GEMINI_API_KEY');
  }

  private isConfigured(): boolean {
    return Boolean(this.geminiKey) && this.geminiKey !== 'your-gemini-api-key';
  }

  // Cover image for an article. Tries real, freely-licensed stock photos
  // first (via imageQuery, an English keyword phrase) — no daily quota,
  // and often more accurate/credible than an AI illustration for factual
  // reference topics (real factories, equipment, etc). Pexels is tried
  // before Pixabay since it's the currently-approved key; Imagen is only
  // a last-resort fallback if neither stock source has a match.
  async generateCoverImage(title: string, imageQuery?: string): Promise<string | null> {
    const query = imageQuery || '';
    const stockUrl = (await this.pexels.searchPhoto(query)) ?? (await this.stockImages.searchPhoto(query));
    if (stockUrl) {
      const uploaded = await this.downloadAndUpload(stockUrl, 'jpg', 'image/jpeg');
      if (uploaded) return uploaded;
    }
    return this.generateAiImage(title);
  }

  private async generateAiImage(title: string): Promise<string | null> {
    if (!this.isConfigured()) return null;

    try {
      const ai = new GoogleGenAI({ apiKey: this.geminiKey });
      const prompt = `Editorial illustration for a Korean news/magazine article titled "${title}". Clean, modern, professional editorial style. No text, no letters, no watermarks in the image.`;

      const resp = await ai.models.generateImages({
        model: IMAGE_MODEL,
        prompt,
        config: { numberOfImages: 1 },
      });

      const imageBytes = resp.generatedImages?.[0]?.image?.imageBytes;
      if (!imageBytes) return null;

      const buffer = Buffer.from(imageBytes, 'base64');
      return this.uploadBuffer(buffer, 'png', 'image/png');
    } catch (err) {
      this.logger.warn(`Cover image generation failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  private async downloadAndUpload(url: string, ext: string, contentType: string): Promise<string | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const buffer = Buffer.from(await res.arrayBuffer());
      return this.uploadBuffer(buffer, ext, contentType);
    } catch (err) {
      this.logger.warn(`Stock photo download failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  private async uploadBuffer(buffer: Buffer, ext: string, contentType: string): Promise<string | null> {
    const filename = `webzine-covers/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const file = this.firebase.getBucket().file(filename);
    await file.save(buffer, { metadata: { contentType } });
    await file.makePublic();
    return `https://storage.googleapis.com/${this.firebase.getBucket().name}/${filename}`;
  }
}
