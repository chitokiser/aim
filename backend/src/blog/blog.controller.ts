import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
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
  listPublished(@Query('category') category?: string) {
    return this.blog.listPublished(category);
  }

  @Get('posts/:slug')
  async getBySlug(@Param('slug') slug: string) {
    const post = await this.blog.getPublishedBySlug(slug);
    void this.blog.incrementViews(slug);
    return post;
  }

  @Get('posts/:slug/comments')
  listComments(@Param('slug') slug: string) {
    return this.blog.listComments(slug);
  }

  @Post('posts/:slug/comments')
  @UseGuards(JwtAuthGuard)
  async addComment(
    @Request() req: { user: { sub: string } },
    @Param('slug') slug: string,
    @Body() body: { content: string },
  ) {
    const user = (await this.users.findById(req.user.sub)) as Record<string, unknown>;
    const userName = (user.firstName as string) || (user.username as string) || 'User';
    return this.blog.addComment(slug, req.user.sub, userName, body.content);
  }

  @Delete('comments/:id')
  @UseGuards(JwtAuthGuard)
  async deleteComment(@Request() req: { user: { sub: string } }, @Param('id') id: string) {
    const isAdmin = await this.users.isAdminUser(req.user.sub);
    await this.blog.deleteComment(id, req.user.sub, isAdmin);
    return { ok: true };
  }

  @Post('posts/:slug/like')
  @UseGuards(JwtAuthGuard)
  toggleLike(@Request() req: { user: { sub: string } }, @Param('slug') slug: string) {
    return this.blog.toggleLike(slug, req.user.sub);
  }

  @Get('posts/:slug/like-status')
  @UseGuards(JwtAuthGuard)
  getLikeStatus(@Request() req: { user: { sub: string } }, @Param('slug') slug: string) {
    return this.blog.getLikeStatus(slug, req.user.sub);
  }

  @Get('admin/posts')
  @UseGuards(JwtAuthGuard)
  async listAll(@Request() req: { user: { sub: string } }) {
    if (!(await this.users.isAdminUser(req.user.sub))) throw new ForbiddenException();
    return this.blog.listAll();
  }

  @Get('admin/suggest-keywords')
  @UseGuards(JwtAuthGuard)
  async suggestKeywords(@Request() req: { user: { sub: string } }) {
    if (!(await this.users.isAdminUser(req.user.sub))) throw new ForbiddenException();
    const keywords = await this.blog.suggestKeywords();
    return { keywords };
  }

  @Post('admin/generate-draft')
  @UseGuards(JwtAuthGuard)
  async generateDraft(
    @Request() req: { user: { sub: string } },
    @Body() body: { keyword: string },
  ) {
    if (!(await this.users.isAdminUser(req.user.sub))) throw new ForbiddenException();
    return this.blog.generateDraft(body.keyword);
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
