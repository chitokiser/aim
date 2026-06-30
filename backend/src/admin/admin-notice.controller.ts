import { Controller, Post, Body, UseGuards, Request, ForbiddenException, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { FirebaseService } from '../firebase/firebase.service';
import { UsersService } from '../users/users.service';

@Controller('admin')
export class AdminNoticeController {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly users: UsersService,
  ) {}

  @Post('notice')
  @UseGuards(JwtAuthGuard)
  async sendNotice(
    @Request() req: { user: { sub: string } },
    @Body() body: { content: string },
  ) {
    if (!(await this.users.isAdminUser(req.user.sub))) throw new ForbiddenException();
    if (!body.content?.trim()) throw new BadRequestException('Notice content is required');
    const ref = await this.firebase.collection('notices').add({
      content: body.content.trim(),
      sentBy: req.user.sub,
      createdAt: new Date().toISOString(),
    });
    return { id: ref.id, ok: true };
  }
}
