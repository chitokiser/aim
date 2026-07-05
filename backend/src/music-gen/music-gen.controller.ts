import {
  Controller, Post, Get, Param, Body,
  HttpException, HttpStatus, UseGuards, Request, Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { UsersService } from '../users/users.service';
import { FirebaseService } from '../firebase/firebase.service';
import { MusicGenService, MurekaResult } from './music-gen.service';
import { randomUUID } from 'crypto';

const GEN_COST_AP = 50;
const GEN_COST_P = 50;
const JOBS_COLLECTION = 'music_gen_jobs';

type JobStatus = 'processing' | 'done' | 'error';

interface Job {
  status: JobStatus;
  step: 1 | 2;
  result?: MurekaResult | null;
  error?: string | null;
  createdAt: string;
}

interface GenerateDto {
  lyrics: string;
  prompt: string;
  currency?: 'ap' | 'p';
}

// Jobs are persisted in Firestore (not held in memory) so an in-progress
// generation survives a backend restart/redeploy — the frontend polls this
// same job document from whichever instance picks up the request next.
@Controller('music-gen')
export class MusicGenController {
  private readonly logger = new Logger(MusicGenController.name);

  constructor(
    private readonly musicGenService: MusicGenService,
    private readonly usersService: UsersService,
    private readonly firebase: FirebaseService,
  ) {}

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
    const job: Job = { status: 'processing', step: 1, createdAt: new Date().toISOString() };
    await this.firebase.collection(JOBS_COLLECTION).doc(jobId).set(job);

    // Run async in background
    this.runGeneration(jobId, body.lyrics ?? '', body.prompt ?? '', req.user.sub, currency);

    return { jobId };
  }

  @Get('status/:jobId')
  @UseGuards(JwtAuthGuard)
  async getStatus(@Param('jobId') jobId: string) {
    const snap = await this.firebase.collection(JOBS_COLLECTION).doc(jobId).get();
    if (!snap.exists) throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
    const job = snap.data() as Job;
    return {
      status: job.status,
      step: job.step,
      result: job.result ?? null,
      error: job.error ?? null,
    };
  }

  private async runGeneration(
    jobId: string,
    lyrics: string,
    prompt: string,
    userId: string,
    currency: 'ap' | 'p',
  ) {
    const ref = this.firebase.collection(JOBS_COLLECTION).doc(jobId);

    try {
      await ref.update({ step: 1 });
      const taskId = await this.musicGenService.startGeneration(lyrics, prompt);

      await ref.update({ step: 2 });
      const result = await this.musicGenService.pollUntilDone(taskId);

      await ref.update({ status: 'done', result });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Music generation failed (job ${jobId}): ${message}`);
      await ref.update({ status: 'error', error: message }).catch(() => {});

      // Refund the deducted cost — the user paid upfront but got no output.
      const cost = currency === 'ap' ? GEN_COST_AP : GEN_COST_P;
      if (currency === 'ap') {
        await this.usersService.addPoints(userId, cost).catch(() => {});
      } else {
        await this.usersService.addFreePoints(userId, cost).catch(() => {});
      }
    }
  }
}
