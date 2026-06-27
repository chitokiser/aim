import {
  Controller, Post, Get, Param, Res, HttpException, HttpStatus,
  UseGuards, Request, UseInterceptors, UploadedFiles,
  Body,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { Express } from 'express';
import * as fs from 'fs';
import { unlink } from 'fs/promises';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { UsersService } from '../users/users.service';
import { MusicVideoService, AspectRatio, EffectOptions, ParticleType } from './music-video.service';
import { randomUUID } from 'crypto';

const MV_COST_AP = 50;
const MV_COST_P = 50;
const JOB_TTL_MS = 15 * 60 * 1000;

type JobStatus = 'processing' | 'done' | 'error';

interface Job {
  status: JobStatus;
  step: 1 | 2 | 3;
  outputPath?: string;
  tmpDir?: string;
  thumbnailPath?: string;
  error?: string;
  createdAt: number;
}

interface GenerateDto {
  text: string;
  title?: string;
  ratio?: AspectRatio;
  currency?: 'ap' | 'p';
  mood?: EffectOptions['mood'];
  glowIntensity?: string;
  vignette?: string;
  panSpeed?: EffectOptions['panSpeed'];
  audioViz?: string;
  particles?: string | string[];
}

@Controller('music-video')
export class MusicVideoController {
  private readonly jobs = new Map<string, Job>();

  constructor(
    private readonly musicVideoService: MusicVideoService,
    private readonly usersService: UsersService,
  ) {
    setInterval(() => this.cleanupJobs(), 5 * 60 * 1000);
  }

  @Post('generate')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'audio', maxCount: 1 },
    { name: 'images', maxCount: 12 },
  ], { limits: { fileSize: 100 * 1024 * 1024 } }))
  async generate(
    @UploadedFiles() files: { audio?: Express.Multer.File[]; images?: Express.Multer.File[] },
    @Body() body: GenerateDto,
    @Request() req: { user: { sub: string } },
  ) {
    const file = files?.audio?.[0];
    if (!file?.buffer) {
      throw new HttpException('MP3 file is required', HttpStatus.BAD_REQUEST);
    }
    if (!body.text?.trim()) {
      throw new HttpException('text is required', HttpStatus.BAD_REQUEST);
    }

    const ratio: AspectRatio = body.ratio === '9:16' ? '9:16' : '16:9';
    const currency = body.currency ?? 'p';
    const userData = await this.usersService.findById(req.user.sub) as {
      points?: number;
      freePoints?: number;
    };

    if (currency === 'ap') {
      if ((userData.points ?? 0) < MV_COST_AP) {
        throw new HttpException('Insufficient AP', HttpStatus.PAYMENT_REQUIRED);
      }
    } else {
      if ((userData.freePoints ?? 0) < MV_COST_P) {
        throw new HttpException('Insufficient P', HttpStatus.PAYMENT_REQUIRED);
      }
    }

    if (currency === 'ap') {
      await this.usersService.deductPoints(req.user.sub, MV_COST_AP);
    } else {
      await this.usersService.deductFreePoints(req.user.sub, MV_COST_P);
    }

    const jobId = randomUUID();
    const job: Job = { status: 'processing', step: 1, createdAt: Date.now() };
    this.jobs.set(jobId, job);

    const rawParticles = body.particles;
    const particleList: ParticleType[] = rawParticles
      ? (Array.isArray(rawParticles) ? rawParticles : [rawParticles]) as ParticleType[]
      : [];

    const effects: EffectOptions = {
      mood: body.mood,
      glowIntensity: body.glowIntensity ? Number(body.glowIntensity) : undefined,
      vignette: body.vignette === 'true',
      panSpeed: body.panSpeed,
      audioViz: (body.audioViz as EffectOptions['audioViz']) ?? 'none',
      particles: particleList,
    };

    const mp3Buffer = Buffer.from(file.buffer);
    const userImages = (files?.images ?? []).map((f) => Buffer.from(f.buffer));
    this.musicVideoService
      .generateToFile(mp3Buffer, body.text, body.title, ratio, userImages, (step) => {
        const j = this.jobs.get(jobId);
        if (j) j.step = step;
      }, effects)
      .then(({ outputPath, tmpDir, thumbnailPath }) => {
        const j = this.jobs.get(jobId);
        if (j) {
          j.status = 'done';
          j.outputPath = outputPath;
          j.tmpDir = tmpDir;
          j.thumbnailPath = thumbnailPath;
        }
      })
      .catch((err: unknown) => {
        const j = this.jobs.get(jobId);
        if (j) {
          j.status = 'error';
          j.error = err instanceof Error ? err.message : String(err);
        }
      });

    return { jobId };
  }

  @Get('status/:jobId')
  @UseGuards(JwtAuthGuard)
  getStatus(@Param('jobId') jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
    return {
      status: job.status,
      step: job.step,
      hasThumbnail: !!job.thumbnailPath,
      error: job.error ?? null,
    };
  }

  @Get('download/:jobId')
  @UseGuards(JwtAuthGuard)
  async download(
    @Param('jobId') jobId: string,
    @Res() res: Response,
  ) {
    const job = this.jobs.get(jobId);
    if (!job) throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
    if (job.status === 'processing') throw new HttpException('Still processing', HttpStatus.ACCEPTED);
    if (job.status === 'error') throw new HttpException(job.error ?? 'Generation failed', HttpStatus.INTERNAL_SERVER_ERROR);
    if (!job.outputPath) throw new HttpException('File not ready', HttpStatus.INTERNAL_SERVER_ERROR);

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', 'attachment; filename="music-video.mp4"');

    const stream = fs.createReadStream(job.outputPath);
    stream.pipe(res);

    stream.on('end', () => {
      // Clean up video tmpDir but keep thumbnailPath alive until TTL
      if (job.tmpDir) {
        fs.rm(job.tmpDir, { recursive: true, force: true }, () => {});
        job.tmpDir = undefined;
        job.outputPath = undefined;
      }
    });

    stream.on('error', () => {
      if (!res.headersSent) res.status(500).end();
    });
  }

  @Get('thumbnail/:jobId')
  @UseGuards(JwtAuthGuard)
  async thumbnail(
    @Param('jobId') jobId: string,
    @Res() res: Response,
  ) {
    const job = this.jobs.get(jobId);
    if (!job) throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
    if (job.status === 'processing') throw new HttpException('Still processing', HttpStatus.ACCEPTED);
    if (!job.thumbnailPath) throw new HttpException('No thumbnail available', HttpStatus.NOT_FOUND);

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="thumbnail.jpg"');

    const stream = fs.createReadStream(job.thumbnailPath);
    stream.pipe(res);

    stream.on('error', () => {
      if (!res.headersSent) res.status(500).end();
    });
  }

  private cleanupJobs() {
    const now = Date.now();
    for (const [id, job] of this.jobs.entries()) {
      if (now - job.createdAt > JOB_TTL_MS) {
        if (job.tmpDir) {
          fs.rm(job.tmpDir, { recursive: true, force: true }, () => {});
        }
        if (job.thumbnailPath) {
          unlink(job.thumbnailPath).catch(() => undefined);
        }
        this.jobs.delete(id);
      }
    }
  }
}
