import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { UsersService } from '../users/users.service';
import { RouletteService } from './roulette.service';

@Controller()
export class RouletteController {
  constructor(
    private readonly roulette: RouletteService,
    private readonly users: UsersService,
  ) {}

  @Post('admin/roulette-events')
  @UseGuards(JwtAuthGuard)
  async createEvent(
    @Request() req: { user: { sub: string } },
    @Body() body: { label: string },
  ) {
    if (!(await this.users.isAdminUser(req.user.sub))) throw new ForbiddenException();
    if (!body.label?.trim()) throw new BadRequestException('Label is required');
    return this.roulette.createEvent(body.label.trim());
  }

  @Get('admin/roulette-events')
  @UseGuards(JwtAuthGuard)
  async listEvents(@Request() req: { user: { sub: string } }) {
    if (!(await this.users.isAdminUser(req.user.sub))) throw new ForbiddenException();
    return this.roulette.listEvents();
  }

  @Get('roulette/status')
  @UseGuards(JwtAuthGuard)
  async status(
    @Request() req: { user: { sub: string } },
    @Query('code') code: string,
  ) {
    if (!code) throw new BadRequestException('code is required');
    return this.roulette.getStatus(req.user.sub, code);
  }

  @Post('roulette/spin')
  @UseGuards(JwtAuthGuard)
  async spin(
    @Request() req: { user: { sub: string } },
    @Body() body: { code: string },
  ) {
    if (!body.code) throw new BadRequestException('code is required');
    return this.roulette.spin(req.user.sub, body.code);
  }
}
