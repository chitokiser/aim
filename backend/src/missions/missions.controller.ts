import {
  Controller, Get, Post, Put, Delete, Patch, Param, Body, Query,
  UseGuards, Request, ForbiddenException, HttpCode,
} from '@nestjs/common';
import { MissionsService } from './missions.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('missions')
export class MissionsController {
  constructor(
    private readonly missionsService: MissionsService,
    private readonly usersService: UsersService,
  ) {}

  // ── Admin: platform vault balance ──────────────────────────────────────────
  // Must appear before :id routes to avoid NestJS route conflict

  @Get('platform-vault')
  @UseGuards(JwtAuthGuard)
  async getPlatformVault(@Request() req: { user: { sub: string } }) {
    if (!(await this.usersService.isAdminUser(req.user.sub))) throw new ForbiddenException();
    return this.missionsService.getPlatformVaultBalance();
  }

  // ── Advertiser: submission review ──────────────────────────────────────────
  // All fixed-name routes must appear before :id param routes

  @Get('my-campaigns')
  @UseGuards(JwtAuthGuard)
  getMyCampaigns(@Request() req: { user: { sub: string } }) {
    return this.missionsService.findByAdvertiser(req.user.sub);
  }

  @Get(':id/pending-submissions')
  @UseGuards(JwtAuthGuard)
  getPendingSubmissions(
    @Param('id') id: string,
    @Request() req: { user: { sub: string } },
  ) {
    return this.missionsService.getPendingSubmissions(id, req.user.sub);
  }

  @Patch('submissions/:submissionId/approve')
  @UseGuards(JwtAuthGuard)
  approveSubmission(
    @Param('submissionId') submissionId: string,
    @Request() req: { user: { sub: string } },
  ) {
    return this.missionsService.approveSubmission(submissionId, req.user.sub);
  }

  @Patch('submissions/:submissionId/reject')
  @UseGuards(JwtAuthGuard)
  rejectSubmission(
    @Param('submissionId') submissionId: string,
    @Request() req: { user: { sub: string } },
  ) {
    return this.missionsService.rejectSubmission(submissionId, req.user.sub);
  }

  // ── Public routes ──────────────────────────────────────────────────────────

  @Get()
  findAll(@Query('status') status?: string) {
    return this.missionsService.findAll(status);
  }

  // Must appear before :id routes
  @Get('templates')
  findTemplates() {
    return this.missionsService.findTemplates();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.missionsService.findById(id);
  }

  @Get(':id/submissions')
  getSubmissions(@Param('id') id: string) {
    return this.missionsService.getSubmissions(id);
  }

  // ── Authenticated routes ───────────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Request() req: { user: { sub: string } },
    @Body() dto: Record<string, unknown>,
  ) {
    return this.missionsService.create(req.user.sub, dto);
  }

  @Post('submit-general')
  @UseGuards(JwtAuthGuard)
  submitGeneral(
    @Request() req: { user: { sub: string } },
    @Body() body: { postUrl: string; section: string; platform: string; description: string; missionId?: string },
  ) {
    return this.missionsService.submitGeneral(req.user.sub, body);
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

  // ── 3-Tier Mission Flow ────────────────────────────────────────────────────

  @Post('template')
  @UseGuards(JwtAuthGuard)
  async createTemplate(
    @Request() req: { user: { sub: string } },
    @Body() dto: Record<string, unknown>,
  ) {
    if (!(await this.usersService.isAdminUser(req.user.sub))) throw new ForbiddenException();
    return this.missionsService.createTemplate(req.user.sub, dto);
  }

  @Post('request')
  @UseGuards(JwtAuthGuard)
  requestCampaign(
    @Request() req: { user: { sub: string } },
    @Body() body: { templateId: string } & Record<string, unknown>,
  ) {
    const { templateId, ...dto } = body;
    return this.missionsService.requestCampaign(req.user.sub, templateId, dto);
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard)
  async approveMission(
    @Param('id') id: string,
    @Request() req: { user: { sub: string } },
  ) {
    if (!(await this.usersService.isAdminUser(req.user.sub))) throw new ForbiddenException();
    return this.missionsService.approveMission(id);
  }

  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard)
  async rejectMission(
    @Param('id') id: string,
    @Request() req: { user: { sub: string } },
    @Body() body: { reason?: string },
  ) {
    if (!(await this.usersService.isAdminUser(req.user.sub))) throw new ForbiddenException();
    return this.missionsService.rejectMission(id, body.reason);
  }

  // ── Admin: create / update / delete missions ──────────────────────────────

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Request() req: { user: { sub: string } },
    @Body() dto: Record<string, unknown>,
  ) {
    const userId = req.user.sub;
    const isAdmin = await this.usersService.isAdminUser(userId);
    if (!isAdmin) {
      const mission = await this.missionsService.findById(id);
      if ((mission as Record<string, unknown>).advertiserId !== userId) throw new ForbiddenException();
    }
    return this.missionsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async remove(
    @Param('id') id: string,
    @Request() req: { user: { sub: string } },
  ) {
    if (!(await this.usersService.isAdminUser(req.user.sub))) throw new ForbiddenException();
    await this.missionsService.remove(id);
  }

  // ── Admin: manual mission settlement ──────────────────────────────────────

  @Post(':id/settle')
  @UseGuards(JwtAuthGuard)
  async settleMission(
    @Param('id') id: string,
    @Request() req: { user: { sub: string } },
  ) {
    if (!(await this.usersService.isAdminUser(req.user.sub))) throw new ForbiddenException();
    return this.missionsService.settleMission(id);
  }
}
