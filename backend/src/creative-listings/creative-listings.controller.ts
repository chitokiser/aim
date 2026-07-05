import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query,
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

  @Get('my-likes')
  @UseGuards(JwtAuthGuard)
  getMyLikes(@Request() req: { user: { sub: string } }) {
    return this.creativeListingsService.getMyLikedIds(req.user.sub);
  }

  @Get(':id/comments')
  getComments(@Param('id') id: string) {
    return this.creativeListingsService.getComments(id);
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

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  like(
    @Param('id') id: string,
    @Request() req: { user: { sub: string } },
  ) {
    return this.creativeListingsService.like(id, req.user.sub);
  }

  @Post(':id/comments')
  @UseGuards(JwtAuthGuard)
  addComment(
    @Param('id') id: string,
    @Request() req: { user: { sub: string } },
    @Body('text') text: string,
  ) {
    return this.creativeListingsService.addComment(id, req.user.sub, text);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @Request() req: { user: { sub: string } },
    @Body() dto: Record<string, unknown>,
  ) {
    return this.creativeListingsService.update(id, req.user.sub, dto);
  }

  @Patch(':id/comments/:commentId')
  @UseGuards(JwtAuthGuard)
  editComment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Request() req: { user: { sub: string } },
    @Body('text') text: string,
  ) {
    return this.creativeListingsService.editComment(id, commentId, req.user.sub, text);
  }

  @Delete(':id/comments/:commentId')
  @UseGuards(JwtAuthGuard)
  deleteComment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Request() req: { user: { sub: string } },
  ) {
    return this.creativeListingsService.deleteComment(id, commentId, req.user.sub);
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
