import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';

const MUREKA_BASE = 'https://api.mureka.ai';
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes max

export interface MurekaResult {
  audioUrls: string[];
  duration?: number;
}

@Injectable()
export class MusicGenService {
  private get apiKey(): string {
    const key = process.env.MUREKA_API_KEY;
    if (!key) throw new HttpException('MUREKA_API_KEY not configured', HttpStatus.INTERNAL_SERVER_ERROR);
    return key;
  }

  async startGeneration(lyrics: string, prompt: string): Promise<string> {
    const res = await axios.post<{ id: string | number; status: string }>(
      `${MUREKA_BASE}/v1/song/generate`,
      { lyrics, model: 'auto', prompt },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      },
    );
    return String(res.data.id);
  }

  async pollUntilDone(taskId: string): Promise<MurekaResult> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    while (Date.now() < deadline) {
      await this.sleep(POLL_INTERVAL_MS);

      const res = await axios.get<Record<string, unknown>>(
        `${MUREKA_BASE}/v1/song/query/${taskId}`,
        {
          headers: { Authorization: `Bearer ${this.apiKey}` },
          timeout: 15000,
        },
      );

      const data = res.data;
      const status = data['status'] as string;

      if (status === 'failed') {
        throw new HttpException('Mureka generation failed', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      if (status === 'succeeded') {
        return this.extractAudioUrls(data);
      }
      // else: preparing / running — keep polling
    }

    throw new HttpException('Music generation timed out', HttpStatus.GATEWAY_TIMEOUT);
  }

  private extractAudioUrls(data: Record<string, unknown>): MurekaResult {
    const urls: string[] = [];

    // Mureka returns results in various shapes depending on model version
    const tryArray = (key: string) => {
      const arr = data[key];
      if (Array.isArray(arr)) {
        arr.forEach((item: unknown) => {
          if (typeof item === 'object' && item !== null) {
            const obj = item as Record<string, unknown>;
            const url = (obj['url'] ?? obj['audio_url'] ?? obj['flac_url']) as string | undefined;
            if (url) urls.push(url);
          }
        });
      }
    };

    tryArray('choices');
    tryArray('songs');
    tryArray('flacs');

    // Flat audio_url field fallback
    if (urls.length === 0 && typeof data['audio_url'] === 'string') {
      urls.push(data['audio_url'] as string);
    }

    if (urls.length === 0) {
      throw new HttpException('No audio URLs in Mureka response', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return { audioUrls: urls };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
