import {
  Controller, Post, Get, Param, Res, HttpException, HttpStatus,
  UseGuards, Request, UseInterceptors, UploadedFile,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { Express } from 'express';
import * as fs from 'fs';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { UsersService } from '../users/users.service';
import { MusicVideoService } from './music-video.service';
import { randomUUID } from 'crypto';

const MV_COST_AP = 1000;
const MV_COST_P = 10000;
const JOB_TTL_MS = 15 * 60 * 1000; // keep finished jobs for 15 minutes

type JobStatus = 'processing' | 'done' | 'error';

interface Job {
  status: JobStatus;
  step: 1 | 2 | 3;
  outputPath?: string;
  tmpDir?: string;
  error?: string;
  createdAt: number;
}

interface GenerateDto {
  text: string;
  currency?: 'ap' | 'p';
}

@Controller('music-video')
export class MusicVideoController {
  private readonly jobs = new Map<string, Job>();

  constructor(
    private readonly musicVideoService: MusicVideoService,
    private readonly usersService: UsersService,
  ) {
    // Periodic cleanup of expired jobs
    setInterval(() => this.cleanupJobs(), 5 * 60 * 1000);
  }

  @Post('generate')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async generate(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: GenerateDto,
    @Request() req: { user: { sub: string } },
  ) {
    if (!file?.buffer) {
      throw new HttpException('MP3 file is required', HttpStatus.BAD_REQUEST);
    }
    if (!body.text?.trim()) {
      throw new HttpException('text is required', HttpStatus.BAD_REQUEST);
    }

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

    // Deduct points before starting (refund not supported for free tier)
    if (currency === 'ap') {
      await this.usersService.deductPoints(req.user.sub, MV_COST_AP);
    } else {
      await this.usersService.deductFreePoints(req.user.sub, MV_COST_P);
    }

    const jobId = randomUUID();
    const job: Job = { status: 'processing', step: 1, createdAt: Date.now() };
    this.jobs.set(jobId, job);

    // Run generation in background — do NOT await here
    const mp3Buffer = Buffer.from(file.buffer);
    this.musicVideoService
      .generateToFile(mp3Buffer, body.text, (step) => {
        const j = this.jobs.get(jobId);
        if (j) j.step = step;
      })
      .then(({ outputPath, tmpDir }) => {
        const j = this.jobs.get(jobId);
        if (j) {
          j.status = 'done';
          j.outputPath = outputPath;
          j.tmpDir = tmpDir;
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
      // Clean up temp directory after download
      if (job.tmpDir) {
        fs.rm(job.tmpDir, { recursive: true, force: true }, () => {});
      }
      this.jobs.delete(jobId);
    });

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
        this.jobs.delete(id);
      }
    }
  }
}
