import {
  Controller, Post, Get, Body, Res, HttpException, HttpStatus,
  UseGuards, Request,
} from '@nestjs/common';
import type { Response } from 'express';
import axios from 'axios';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { UsersService } from '../users/users.service';

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';
const TTS_COST_AP = 50;
const TTS_COST_P = 500;

interface GenerateDto {
  text: string;
  voiceId: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  speed?: number;
  currency?: 'ap' | 'p';
}

@Controller('tts')
export class TtsController {
  constructor(private readonly usersService: UsersService) {}

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
  @UseGuards(JwtAuthGuard)
  async generate(
    @Body() body: GenerateDto,
    @Res() res: Response,
    @Request() req: { user: { sub: string } },
  ) {
    const {
      text,
      voiceId,
      modelId = 'eleven_multilingual_v2',
      stability = 0.5,
      similarityBoost = 0.75,
      speed = 1.0,
      currency = 'p',
    } = body;

    if (!text?.trim() || !voiceId) {
      throw new HttpException('text and voiceId are required', HttpStatus.BAD_REQUEST);
    }

    // Verify balance before calling ElevenLabs
    const userData = await this.usersService.findById(req.user.sub) as {
      points?: number;
      freePoints?: number;
    };

    if (currency === 'ap') {
      if ((userData.points ?? 0) < TTS_COST_AP) {
        throw new HttpException('Insufficient AP', HttpStatus.PAYMENT_REQUIRED);
      }
    } else {
      if ((userData.freePoints ?? 0) < TTS_COST_P) {
        throw new HttpException('Insufficient P', HttpStatus.PAYMENT_REQUIRED);
      }
    }

    try {
      const requestBody: Record<string, unknown> = {
        text,
        model_id: modelId,
        voice_settings: { stability, similarity_boost: similarityBoost },
      };
      if (speed !== 1.0) requestBody.speed = speed;

      const elevenRes = await axios.post<ArrayBuffer>(
        `${ELEVENLABS_BASE}/text-to-speech/${voiceId}`,
        requestBody,
        {
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          responseType: 'arraybuffer',
        },
      );

      // Deduct points only after successful generation
      if (currency === 'ap') {
        await this.usersService.deductPoints(req.user.sub, TTS_COST_AP);
      } else {
        await this.usersService.deductFreePoints(req.user.sub, TTS_COST_P);
      }

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
