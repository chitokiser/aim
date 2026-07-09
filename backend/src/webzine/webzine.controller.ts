import { Controller, Get, Post, Body, Param, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { UsersService } from '../users/users.service';
import { WebzineConfigService } from './webzine-config.service';
import { WebzineSchedulerService } from './webzine-scheduler.service';
import { CATEGORIES } from './webzine.constants';

@Controller('blog/admin/webzine')
export class WebzineController {
  constructor(
    private readonly users: UsersService,
    private readonly config: WebzineConfigService,
    private readonly scheduler: WebzineSchedulerService,
  ) {}

  @Get('categories')
  @UseGuards(JwtAuthGuard)
  async listCategories(@Request() req: { user: { sub: string } }) {
    if (!(await this.users.isAdminUser(req.user.sub))) throw new ForbiddenException();
    const state = await this.config.getState();
    return CATEGORIES.map((c) => ({
      ...c,
      enabled: state.enabled[c.slug],
      lastRunAt: state.lastRunAt[c.slug] ?? null,
    }));
  }

  @Post('toggle')
  @UseGuards(JwtAuthGuard)
  async toggle(@Request() req: { user: { sub: string } }, @Body() body: { category: string; enabled: boolean }) {
    if (!(await this.users.isAdminUser(req.user.sub))) throw new ForbiddenException();
    await this.config.setEnabled(body.category, body.enabled);
    return { ok: true };
  }

  @Post('run/:category')
  @UseGuards(JwtAuthGuard)
  async run(@Request() req: { user: { sub: string } }, @Param('category') category: string) {
    if (!(await this.users.isAdminUser(req.user.sub))) throw new ForbiddenException();
    const post = await this.scheduler.runCategory(category);
    return post ?? { ok: false, message: 'No article generated from current news sources' };
  }

  // Runs the ~40-article daily batch on demand instead of waiting for the
  // midnight cron. Fires in the background since it takes several minutes.
  @Post('run-daily-batch')
  @UseGuards(JwtAuthGuard)
  async runDailyBatchNow(@Request() req: { user: { sub: string } }) {
    if (!(await this.users.isAdminUser(req.user.sub))) throw new ForbiddenException();
    void this.scheduler.runDailyBatch();
    return { ok: true, message: 'Daily batch started in the background' };
  }
}
