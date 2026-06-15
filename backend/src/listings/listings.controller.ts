import {
  Controller, Get, Post, Delete, Param, Body, Query,
  UseGuards, Request,
} from '@nestjs/common';
import { ListingsService } from './listings.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get()
  findAll(@Query('category') category?: string) {
    return this.listingsService.findAll(category);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  findMine(@Request() req: { user: { sub: string } }) {
    return this.listingsService.findByUser(req.user.sub);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Request() req: { user: { sub: string } },
    @Body() dto: Record<string, unknown>,
  ) {
    return this.listingsService.create(req.user.sub, dto);
  }

  @Post(':id/promote')
  @UseGuards(JwtAuthGuard)
  promote(
    @Param('id') id: string,
    @Request() req: { user: { sub: string } },
  ) {
    return this.listingsService.promote(id, req.user.sub);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(
    @Param('id') id: string,
    @Request() req: { user: { sub: string } },
  ) {
    return this.listingsService.remove(id, req.user.sub);
  }
}
