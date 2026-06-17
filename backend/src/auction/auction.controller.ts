import {
  Controller, Get, Post, Param, Body, Query,
  UseGuards, Request, ForbiddenException,
} from '@nestjs/common';
import { AuctionService } from './auction.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('auction')
export class AuctionController {
  constructor(private readonly auctionService: AuctionService) {}

  // ─── Public ──────────────────────────────────────────────────────────────────

  @Get()
  findAll(
    @Query('sort') sort?: string,
    @Query('category') category?: string,
  ) {
    return this.auctionService.findAll(sort, category);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.auctionService.findOne(id);
  }

  @Get(':id/bids')
  findBids(@Param('id') id: string) {
    return this.auctionService.findBids(id);
  }

  // ─── Authenticated ────────────────────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Request() req: { user: { sub: string } },
    @Body() dto: Record<string, unknown>,
  ) {
    return this.auctionService.create(req.user.sub, dto);
  }

  @Post(':id/bid')
  @UseGuards(JwtAuthGuard)
  placeBid(
    @Param('id') id: string,
    @Request() req: { user: { sub: string } },
    @Body() body: { amount: number },
  ) {
    return this.auctionService.placeBid(id, req.user.sub, Number(body.amount));
  }

  @Post(':id/buy-now')
  @UseGuards(JwtAuthGuard)
  buyNow(
    @Param('id') id: string,
    @Request() req: { user: { sub: string } },
  ) {
    return this.auctionService.buyNow(id, req.user.sub);
  }

  @Post(':id/confirm-transfer')
  @UseGuards(JwtAuthGuard)
  confirmTransfer(
    @Param('id') id: string,
    @Request() req: { user: { sub: string } },
  ) {
    return this.auctionService.confirmTransfer(id, req.user.sub);
  }

  @Post(':id/dispute')
  @UseGuards(JwtAuthGuard)
  raiseDispute(
    @Param('id') id: string,
    @Request() req: { user: { sub: string } },
  ) {
    return this.auctionService.raiseDispute(id, req.user.sub);
  }

  // ─── Admin ────────────────────────────────────────────────────────────────────

  @Get('admin/all')
  @UseGuards(JwtAuthGuard)
  adminFindAll(
    @Request() req: { user: { sub: string; isAdmin?: boolean } },
    @Query('status') status?: string,
  ) {
    if (!req.user.isAdmin) throw new ForbiddenException();
    return this.auctionService.adminFindAll(status);
  }

  @Post('admin/:id/approve')
  @UseGuards(JwtAuthGuard)
  adminApprove(
    @Param('id') id: string,
    @Request() req: { user: { sub: string; isAdmin?: boolean } },
  ) {
    if (!req.user.isAdmin) throw new ForbiddenException();
    return this.auctionService.adminApprove(id);
  }

  @Post('admin/:id/stop')
  @UseGuards(JwtAuthGuard)
  adminStop(
    @Param('id') id: string,
    @Request() req: { user: { sub: string; isAdmin?: boolean } },
  ) {
    if (!req.user.isAdmin) throw new ForbiddenException();
    return this.auctionService.adminStop(id);
  }

  @Post('admin/:id/resolve')
  @UseGuards(JwtAuthGuard)
  adminResolveDispute(
    @Param('id') id: string,
    @Request() req: { user: { sub: string; isAdmin?: boolean } },
    @Body() body: { resolution: 'buyer' | 'seller' },
  ) {
    if (!req.user.isAdmin) throw new ForbiddenException();
    return this.auctionService.adminResolveDispute(id, body.resolution);
  }
}
