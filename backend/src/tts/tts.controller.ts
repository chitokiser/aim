import {
  Controller, Post, Get, Body, Res, HttpException, HttpStatus,
  UseGuards, Request,
} from '@nestjs/common';
import type { Response } from 'express';
import axios from 'axios';
import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { UsersService } from '../users/users.service';

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';
const COST_PER_10S_AP = 50;
const COST_PER_10S_P = 500;

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

  private async getAudioDuration(buffer: Buffer): Promise<number> {
    const tmpFile = join(tmpdir(), `tts-${Date.now()}.mp3`);
    try {
      await writeFile(tmpFile, buffer);
      return await new Promise<number>((resolve) => {
        const proc = spawn('ffprobe', [
          '-v', 'error',
          '-show_entries', 'format=duration',
          '-of', 'default=noprint_wrappers=1:nokey=1',
          tmpFile,
        ]);
        let out = '';
        proc.stdout.on('data', (d: Buffer) => { out += d.toString(); });
        proc.on('close', () => {
          const sec = parseFloat(out.trim());
          resolve(isNaN(sec) ? 10 : sec);
        });
        proc.on('error', () => resolve(10));
      });
    } finally {
      await unlink(tmpFile).catch(() => undefined);
    }
  }

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

    // Verify minimum balance (at least 1 block = 10s) before calling ElevenLabs
    const userData = await this.usersService.findById(req.user.sub) as {
      points?: number;
      freePoints?: number;
    };

    if (currency === 'ap') {
      if ((userData.points ?? 0) < COST_PER_10S_AP) {
        throw new HttpException('Insufficient AP', HttpStatus.PAYMENT_REQUIRED);
      }
    } else {
      if ((userData.freePoints ?? 0) < COST_PER_10S_P) {
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

      const audioBuffer = Buffer.from(elevenRes.data);
      const durationSec = await this.getAudioDuration(audioBuffer);
      const blocks = Math.ceil(durationSec / 10);
      const costAp = blocks * COST_PER_10S_AP;
      const costP = blocks * COST_PER_10S_P;

      // Re-fetch balance and check actual cost after knowing duration
      const freshUser = await this.usersService.findById(req.user.sub) as {
        points?: number;
        freePoints?: number;
      };
      if (currency === 'ap') {
        if ((freshUser.points ?? 0) < costAp) {
          throw new HttpException('Insufficient AP', HttpStatus.PAYMENT_REQUIRED);
        }
        await this.usersService.deductPoints(req.user.sub, costAp);
      } else {
        if ((freshUser.freePoints ?? 0) < costP) {
          throw new HttpException('Insufficient P', HttpStatus.PAYMENT_REQUIRED);
        }
        await this.usersService.deductFreePoints(req.user.sub, costP);
      }

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', 'attachment; filename="tts-output.mp3"');
      res.setHeader('X-Audio-Duration', durationSec.toFixed(2));
      res.setHeader('X-Cost', currency === 'ap' ? costAp : costP);
      res.send(audioBuffer);
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: unknown }; message?: string };
      throw new HttpException(
        err.message ?? 'ElevenLabs error',
        err.response?.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
