import {
  Controller, Get, Put, Param, Body, Query, UseGuards, Request
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(@Request() req: { user: { sub: string } }) {
    return this.usersService.findById(req.user.sub);
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

  @Get('leaderboard/list')
  getLeaderboard(@Query('period') period: string = 'all') {
    return this.usersService.getLeaderboard(period);
  }
}
