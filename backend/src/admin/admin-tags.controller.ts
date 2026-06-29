import {
  Controller, Get, Post, Delete, Param, Body,
  UseGuards, Request, ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { FirebaseService } from '../firebase/firebase.service';
import { UsersService } from '../users/users.service';

const CONFIG_DOC = 'platform';
const TAGS_FIELD = 'requiredTags';
const DEFAULT_TAGS = ['#AI119', '#AIcreator', '#AIcf', '#AICMsong', '#AI리뷰', '#창작'];

@Controller('admin/tags')
export class AdminTagsController {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly users: UsersService,
  ) {}

  private async assertAdmin(userId: string) {
    if (!(await this.users.isAdminUser(userId))) throw new ForbiddenException();
  }

  private get configDoc() {
    return this.firebase.collection('config').doc(CONFIG_DOC);
  }

  @Get()
  async getTags() {
    const snap = await this.configDoc.get();
    return { tags: (snap.data()?.[TAGS_FIELD] as string[]) ?? DEFAULT_TAGS };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async addTag(
    @Request() req: { user: { sub: string } },
    @Body('tag') tag: string,
  ) {
    await this.assertAdmin(req.user.sub);
    if (!tag?.trim()) throw new ForbiddenException('Tag is required');

    const normalized = tag.trim().startsWith('#') ? tag.trim() : `#${tag.trim()}`;
    const snap = await this.configDoc.get();
    const current: string[] = (snap.data()?.[TAGS_FIELD] as string[]) ?? DEFAULT_TAGS;

    if (current.includes(normalized)) {
      return { tags: current };
    }

    const updated = [...current, normalized];
    await this.configDoc.set({ [TAGS_FIELD]: updated }, { merge: true });
    return { tags: updated };
  }

  @Delete(':tag')
  @UseGuards(JwtAuthGuard)
  async deleteTag(
    @Request() req: { user: { sub: string } },
    @Param('tag') tag: string,
  ) {
    await this.assertAdmin(req.user.sub);

    const snap = await this.configDoc.get();
    const current: string[] = (snap.data()?.[TAGS_FIELD] as string[]) ?? DEFAULT_TAGS;
    const updated = current.filter((t) => t !== decodeURIComponent(tag));
    await this.configDoc.set({ [TAGS_FIELD]: updated }, { merge: true });
    return { tags: updated };
  }
}
