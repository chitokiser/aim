import {
  Controller, Get, Post, Param, Body, Query, UseGuards, Request
} from '@nestjs/common';
import { MissionsService } from './missions.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('missions')
export class MissionsController {
  constructor(private readonly missionsService: MissionsService) {}

  @Get()
  findAll(@Query('status') status?: string) {
    return this.missionsService.findAll(status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.missionsService.findById(id);
  }

  @Get(':id/submissions')
  getSubmissions(@Param('id') id: string) {
    return this.missionsService.getSubmissions(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Request() req: { user: { sub: string } },
    @Body() dto: Record<string, unknown>,
  ) {
    return this.missionsService.create(req.user.sub, dto);
  }

  @Post('escrow')
  @UseGuards(JwtAuthGuard)
  createWithEscrow(
    @Request() req: { user: { sub: string } },
    @Body() dto: Record<string, unknown>,
  ) {
    return this.missionsService.createWithEscrow(req.user.sub, dto);
  }

  @Post(':id/submit')
  @UseGuards(JwtAuthGuard)
  submit(
    @Param('id') id: string,
    @Request() req: { user: { sub: string } },
    @Body() body: { postUrl: string; tags: string[] },
  ) {
    return this.missionsService.submitPost(id, req.user.sub, body.postUrl, body.tags);
  }

  @Post(':id/submit-links')
  @UseGuards(JwtAuthGuard)
  submitLinks(
    @Param('id') id: string,
    @Request() req: { user: { sub: string } },
    @Body() body: { youtube?: string; blog?: string; comment?: string; screenshot?: string },
  ) {
    return this.missionsService.submitLinks(id, req.user.sub, body);
  }

  @Post('submissions/:submissionId/like')
  @UseGuards(JwtAuthGuard)
  likeSubmission(
    @Param('submissionId') submissionId: string,
    @Request() req: { user: { sub: string } },
  ) {
    return this.missionsService.likeSubmission(submissionId, req.user.sub);
  }
}
