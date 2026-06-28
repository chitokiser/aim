import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { WithdrawalsService } from './withdrawals.service';

@Controller('withdrawals')
export class WithdrawalsController {
  constructor(private readonly svc: WithdrawalsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Request() req: { user: { sub: string } },
    @Body() body: { apAmount: number; tonWallet: string },
  ) {
    return this.svc.create(req.user.sub, body.apAmount, body.tonWallet);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  myHistory(@Request() req: { user: { sub: string } }) {
    return this.svc.getMyHistory(req.user.sub);
  }

  @Get('admin/list')
  @UseGuards(JwtAuthGuard)
  adminList(
    @Request() req: { user: { sub: string } },
    @Query('status') status?: string,
  ) {
    void req;
    return this.svc.adminList(status);
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard)
  approve(
    @Request() req: { user: { sub: string } },
    @Param('id') id: string,
    @Body() body: { txHash?: string },
  ) {
    return this.svc.approve(req.user.sub, id, body.txHash ?? '');
  }

  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard)
  reject(
    @Request() req: { user: { sub: string } },
    @Param('id') id: string,
    @Body() body: { adminNote?: string },
  ) {
    return this.svc.reject(req.user.sub, id, body.adminNote ?? '');
  }
}
