import {
  Controller, Get, Put, Post, Param, Body, Query,
  UseGuards, Request, ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { PointsService } from '../points/points.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly pointsService: PointsService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(@Request() req: { user: { sub: string } }) {
    return this.usersService.findById(req.user.sub);
  }

  @Get('admin/list')
  @UseGuards(JwtAuthGuard)
  async listAll(
    @Request() req: { user: { sub: string } },
    @Query('search') search?: string,
  ) {
    if (!(await this.usersService.isAdminUser(req.user.sub))) throw new ForbiddenException();
    return this.usersService.findAll(search);
  }

  @Post(':id/charge-ap')
  @UseGuards(JwtAuthGuard)
  async chargeAp(
    @Request() req: { user: { sub: string } },
    @Param('id') id: string,
    @Body() body: { amount: number; reason: string },
  ) {
    if (!(await this.usersService.isAdminUser(req.user.sub))) throw new ForbiddenException();
    return this.pointsService.award(id, body.amount, 'admin_charge', body.reason ?? 'Admin charge');
  }

  @Get(':id/transactions')
  @UseGuards(JwtAuthGuard)
  async getUserTransactions(
    @Request() req: { user: { sub: string } },
    @Param('id') id: string,
  ) {
    if (!(await this.usersService.isAdminUser(req.user.sub))) throw new ForbiddenException();
    return this.pointsService.getHistory(id);
  }

  @Get('leaderboard/list')
  getLeaderboard(@Query('period') period: string = 'all') {
    return this.usersService.getLeaderboard(period);
  }

  // Public: returns only non-sensitive fields (no bot token)
  @Get('public/telegram-info')
  async getPublicTelegramInfo() {
    const s = await this.usersService.getTelegramSettings();
    const { botToken: _, ...safe } = s as Record<string, string> & { botToken?: string };
    void _;
    return safe;
  }

  @Get('admin/telegram-settings')
  @UseGuards(JwtAuthGuard)
  async getTelegramSettings(@Request() req: { user: { sub: string } }) {
    if (!(await this.usersService.isAdminUser(req.user.sub))) throw new ForbiddenException();
    return this.usersService.getTelegramSettings();
  }

  @Put('admin/telegram-settings')
  @UseGuards(JwtAuthGuard)
  async saveTelegramSettings(
    @Request() req: { user: { sub: string } },
    @Body() body: Record<string, string>,
  ) {
    if (!(await this.usersService.isAdminUser(req.user.sub))) throw new ForbiddenException();
    return this.usersService.saveTelegramSettings(body);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  updateProfile(
    @Request() req: { user: { sub: string } },
    @Body() dto: { username?: string; firstName?: string },
  ) {
    return this.usersService.update(req.user.sub, dto);
  }
}
