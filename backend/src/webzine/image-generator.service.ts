import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { FirebaseService } from '../firebase/firebase.service';

const IMAGE_MODEL = 'imagen-4.0-generate-001';

@Injectable()
export class ImageGeneratorService {
  private readonly logger = new Logger(ImageGeneratorService.name);
  private readonly geminiKey?: string;

  constructor(
    private readonly config: ConfigService,
    private readonly firebase: FirebaseService,
  ) {
    this.geminiKey = this.config.get<string>('GEMINI_API_KEY');
  }

  private isConfigured(): boolean {
    return Boolean(this.geminiKey) && this.geminiKey !== 'your-gemini-api-key';
  }

  // Generates a cover image for an article and uploads it to Firebase
  // Storage, returning a public URL. Imagen requires a billing-enabled
  // Google Cloud project (unlike the free-tier Gemini text models), so
  // this fails closed: any error just means no cover image, never blocks
  // article creation.
  async generateCoverImage(title: string): Promise<string | null> {
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
      const filename = `webzine-covers/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
      const file = this.firebase.getBucket().file(filename);
      await file.save(buffer, { metadata: { contentType: 'image/png' } });
      await file.makePublic();

      return `https://storage.googleapis.com/${this.firebase.getBucket().name}/${filename}`;
    } catch (err) {
      this.logger.warn(`Cover image generation failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }
}
