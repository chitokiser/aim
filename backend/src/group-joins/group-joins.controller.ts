import { Controller, Get, Param, Request, UseGuards } from '@nestjs/common';
import { GroupJoinsService } from './group-joins.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('group-joins')
export class GroupJoinsController {
  constructor(private readonly groupJoinsService: GroupJoinsService) {}

  @Get('mission/:id/stats')
  @UseGuards(JwtAuthGuard)
  getMissionStats(@Param('id') id: string) {
    return this.groupJoinsService.getMissionRetentionStats(id);
  }

  @Get('my-score')
  @UseGuards(JwtAuthGuard)
  getMyScore(@Request() req: { user: { sub: string } }) {
    return this.groupJoinsService.getBlackScore(req.user.sub);
  }
}
