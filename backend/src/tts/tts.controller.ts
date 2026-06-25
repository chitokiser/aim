import {
  Controller, Post, Get, Body, Res, HttpException, HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import axios from 'axios';

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

interface GenerateDto {
  text: string;
  voiceId: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  speed?: number;
}

@Controller('tts')
export class TtsController {
  private get apiKey(): string {
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) throw new HttpException('ElevenLabs API key not configured', HttpStatus.SERVICE_UNAVAILABLE);
    return key;
  }

  @Get('voices')
  async getVoices() {
    try {
      const res = await axios.get<{ voices: unknown[] }>(`${ELEVENLABS_BASE}/voices`, {
        headers: { 'xi-api-key': this.apiKey },
      });
      return res.data;
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: unknown }; message?: string };
      throw new HttpException(
        err.response?.data ?? err.message ?? 'ElevenLabs error',
        err.response?.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('generate')
  async generate(@Body() body: GenerateDto, @Res() res: Response) {
    const {
      text,
      voiceId,
      modelId = 'eleven_multilingual_v2',
      stability = 0.5,
      similarityBoost = 0.75,
      speed = 1.0,
    } = body;

    if (!text?.trim() || !voiceId) {
      throw new HttpException('text and voiceId are required', HttpStatus.BAD_REQUEST);
    }

    try {
      const elevenRes = await axios.post<ArrayBuffer>(
        `${ELEVENLABS_BASE}/text-to-speech/${voiceId}`,
        {
          text,
          model_id: modelId,
          voice_settings: { stability, similarity_boost: similarityBoost },
          speed,
        },
        {
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          responseType: 'arraybuffer',
        },
      );

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', 'attachment; filename="tts-output.mp3"');
      res.send(Buffer.from(elevenRes.data));
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: unknown }; message?: string };
      throw new HttpException(
        err.message ?? 'ElevenLabs error',
        err.response?.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
