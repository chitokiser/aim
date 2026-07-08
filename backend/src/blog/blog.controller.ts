import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { UsersService } from '../users/users.service';
import { BlogService } from './blog.service';
import type { BlogPostInput } from './blog.service';

@Controller('blog')
export class BlogController {
  constructor(
    private readonly blog: BlogService,
    private readonly users: UsersService,
  ) {}

  @Get('posts')
  listPublished() {
    return this.blog.listPublished();
  }

  @Get('posts/:slug')
  getBySlug(@Param('slug') slug: string) {
    return this.blog.getPublishedBySlug(slug);
  }

  @Get('admin/posts')
  @UseGuards(JwtAuthGuard)
  async listAll(@Request() req: { user: { sub: string } }) {
    if (!(await this.users.isAdminUser(req.user.sub))) throw new ForbiddenException();
    return this.blog.listAll();
  }

  @Post('admin/posts')
  @UseGuards(JwtAuthGuard)
  async create(
    @Request() req: { user: { sub: string } },
    @Body() body: BlogPostInput,
  ) {
    if (!(await this.users.isAdminUser(req.user.sub))) throw new ForbiddenException();
    return this.blog.create(body);
  }

  @Patch('admin/posts/:id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Request() req: { user: { sub: string } },
    @Param('id') id: string,
    @Body() body: BlogPostInput,
  ) {
    if (!(await this.users.isAdminUser(req.user.sub))) throw new ForbiddenException();
    return this.blog.update(id, body);
  }

  @Delete('admin/posts/:id')
  @UseGuards(JwtAuthGuard)
  async remove(
    @Request() req: { user: { sub: string } },
    @Param('id') id: string,
  ) {
    if (!(await this.users.isAdminUser(req.user.sub))) throw new ForbiddenException();
    await this.blog.remove(id);
    return { ok: true };
  }
}
