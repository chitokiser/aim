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

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Request() req: { user: { sub: string } },
    @Body() dto: Record<string, unknown>,
  ) {
    return this.missionsService.create(req.user.sub, dto);
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
}
