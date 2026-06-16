import {
  Controller, Get, Post, Delete, Param, Body, Query,
  UseGuards, Request,
} from '@nestjs/common';
import { CreativeListingsService } from './creative-listings.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('creative-listings')
export class CreativeListingsController {
  constructor(private readonly creativeListingsService: CreativeListingsService) {}

  @Get()
  findAll(@Query('contentType') contentType?: string) {
    return this.creativeListingsService.findAll(contentType);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  findMine(@Request() req: { user: { sub: string } }) {
    return this.creativeListingsService.findByUser(req.user.sub);
  }

  @Get('purchases')
  @UseGuards(JwtAuthGuard)
  findPurchases(@Request() req: { user: { sub: string } }) {
    return this.creativeListingsService.findPurchasesByUser(req.user.sub);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Request() req: { user: { sub: string } },
    @Body() dto: Record<string, unknown>,
  ) {
    return this.creativeListingsService.create(req.user.sub, dto);
  }

  @Post(':id/purchase')
  @UseGuards(JwtAuthGuard)
  purchase(
    @Param('id') id: string,
    @Request() req: { user: { sub: string } },
  ) {
    return this.creativeListingsService.purchase(id, req.user.sub);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(
    @Param('id') id: string,
    @Request() req: { user: { sub: string } },
  ) {
    return this.creativeListingsService.remove(id, req.user.sub);
  }
}
