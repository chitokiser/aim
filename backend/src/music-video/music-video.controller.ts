import {
  Controller, Post, Res, HttpException, HttpStatus,
  UseGuards, Request, UseInterceptors, UploadedFile,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { Express } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { UsersService } from '../users/users.service';
import { MusicVideoService } from './music-video.service';

const MV_COST_AP = 1000;
const MV_COST_P = 10000;

interface GenerateDto {
  text: string;
  currency?: 'ap' | 'p';
}

@Controller('music-video')
export class MusicVideoController {
  constructor(
    private readonly musicVideoService: MusicVideoService,
    private readonly usersService: UsersService,
  ) {}

  @Post('generate')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async generate(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: GenerateDto,
    @Res() res: Response,
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

    const mp4Buffer = await this.musicVideoService.generate(file.buffer, body.text);

    if (currency === 'ap') {
      await this.usersService.deductPoints(req.user.sub, MV_COST_AP);
    } else {
      await this.usersService.deductFreePoints(req.user.sub, MV_COST_P);
    }

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', 'attachment; filename="music-video.mp4"');
    res.send(mp4Buffer);
  }
}
