import {
  Controller, Post, Get, Param, Body,
  HttpException, HttpStatus, UseGuards, Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { UsersService } from '../users/users.service';
import { MusicGenService, MurekaResult } from './music-gen.service';
import { randomUUID } from 'crypto';

const GEN_COST_AP = 50;
const GEN_COST_P = 50;
const JOB_TTL_MS = 30 * 60 * 1000;

type JobStatus = 'processing' | 'done' | 'error';

interface Job {
  status: JobStatus;
  step: 1 | 2;
  result?: MurekaResult;
  error?: string;
  createdAt: number;
}

interface GenerateDto {
  lyrics: string;
  prompt: string;
  currency?: 'ap' | 'p';
}

@Controller('music-gen')
export class MusicGenController {
  private readonly jobs = new Map<string, Job>();

  constructor(
    private readonly musicGenService: MusicGenService,
    private readonly usersService: UsersService,
  ) {
    setInterval(() => this.cleanupJobs(), 10 * 60 * 1000);
  }

  @Post('generate')
  @UseGuards(JwtAuthGuard)
  async generate(
    @Body() body: GenerateDto,
    @Request() req: { user: { sub: string } },
  ) {
    if (!body.lyrics?.trim() && !body.prompt?.trim()) {
      throw new HttpException('lyrics or prompt is required', HttpStatus.BAD_REQUEST);
    }

    const currency = body.currency ?? 'p';
    const userData = await this.usersService.findById(req.user.sub) as {
      points?: number;
      freePoints?: number;
    };

    if (currency === 'ap') {
      if ((userData.points ?? 0) < GEN_COST_AP) {
        throw new HttpException('Insufficient AP', HttpStatus.PAYMENT_REQUIRED);
      }
      await this.usersService.deductPoints(req.user.sub, GEN_COST_AP);
    } else {
      if ((userData.freePoints ?? 0) < GEN_COST_P) {
        throw new HttpException('Insufficient P', HttpStatus.PAYMENT_REQUIRED);
      }
      await this.usersService.deductFreePoints(req.user.sub, GEN_COST_P);
    }

    const jobId = randomUUID();
    const job: Job = { status: 'processing', step: 1, createdAt: Date.now() };
    this.jobs.set(jobId, job);

    // Run async in background
    this.runGeneration(jobId, body.lyrics ?? '', body.prompt ?? '');

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
      result: job.result ?? null,
      error: job.error ?? null,
    };
  }

  private async runGeneration(jobId: string, lyrics: string, prompt: string) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    try {
      job.step = 1;
      const taskId = await this.musicGenService.startGeneration(lyrics, prompt);

      job.step = 2;
      const result = await this.musicGenService.pollUntilDone(taskId);

      job.status = 'done';
      job.result = result;
    } catch (err: unknown) {
      job.status = 'error';
      job.error = err instanceof Error ? err.message : String(err);
    }
  }

  private cleanupJobs() {
    const now = Date.now();
    for (const [id, job] of this.jobs.entries()) {
      if (now - job.createdAt > JOB_TTL_MS) {
        this.jobs.delete(id);
      }
    }
  }
}
