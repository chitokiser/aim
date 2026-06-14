import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { PointsService } from './points.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('points')
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Get('history')
  @UseGuards(JwtAuthGuard)
  getHistory(@Request() req: { user: { sub: string } }) {
    return this.pointsService.getHistory(req.user.sub);
  }

  @Post('withdraw')
  @UseGuards(JwtAuthGuard)
  withdraw(
    @Request() req: { user: { sub: string } },
    @Body() body: { amount: number; walletAddress: string },
  ) {
    return this.pointsService.deduct(
      req.user.sub,
      body.amount,
      `TON 출금 → ${body.walletAddress}`,
    );
  }
}
