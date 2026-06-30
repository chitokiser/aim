import {
  Controller, Get, Post, Delete, Patch, Param, Body,
  UseGuards, Request, ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { FirebaseService } from '../firebase/firebase.service';
import { UsersService } from '../users/users.service';

interface CoupangCreateDto {
  name?: string;
  iframeCode: string;
  videoUrl?: string;
}

interface CoupangUpdateDto {
  active?: boolean;
  name?: string;
  videoUrl?: string;
}

@Controller('coupang')
export class CoupangController {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly usersService: UsersService,
  ) {}

  @Get('products')
  async findAll() {
    const snap = await this.firebase
      .collection('coupang_products')
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((p: Record<string, unknown>) => p['active'] !== false);
  }

  @Get('products/all')
  @UseGuards(JwtAuthGuard)
  async findAllAdmin(@Request() req: { user: { userId: string } }) {
    const user = await this.usersService.findById(req.user.userId);
    if (!user?.isAdmin) throw new ForbiddenException();
    const snap = await this.firebase
      .collection('coupang_products')
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  @Post('products')
  @UseGuards(JwtAuthGuard)
  async create(
    @Request() req: { user: { userId: string } },
    @Body() body: CoupangCreateDto,
  ) {
    const user = await this.usersService.findById(req.user.userId);
    if (!user?.isAdmin) throw new ForbiddenException();

    const srcMatch = body.iframeCode.match(/src="([^"]+)"/);
    const iframeSrc = srcMatch?.[1] ?? '';
    const shortCode = iframeSrc.split('/').pop() ?? '';

    const widthMatch = body.iframeCode.match(/width="(\d+)"/);
    const heightMatch = body.iframeCode.match(/height="(\d+)"/);
    const iframeWidth = widthMatch ? parseInt(widthMatch[1]) : 120;
    const iframeHeight = heightMatch ? parseInt(heightMatch[1]) : 240;

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const regNo = `CPN-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    const name = body.name?.trim() || `쿠팡 상품 #${shortCode}`;

    const doc = {
      regNo,
      name,
      iframeCode: body.iframeCode,
      iframeSrc,
      iframeWidth,
      iframeHeight,
      videoUrl: body.videoUrl?.trim() || null,
      active: true,
      createdAt: now.toISOString(),
    };

    const ref = await this.firebase.collection('coupang_products').add(doc);
    return { id: ref.id, ...doc };
  }

  @Patch('products/:id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() body: CoupangUpdateDto,
  ) {
    const user = await this.usersService.findById(req.user.userId);
    if (!user?.isAdmin) throw new ForbiddenException();

    const update: Record<string, unknown> = {};
    if (typeof body.active === 'boolean') update['active'] = body.active;
    if (body.name?.trim()) update['name'] = body.name.trim();
    if (body.videoUrl !== undefined) update['videoUrl'] = body.videoUrl?.trim() || null;

    await this.firebase.collection('coupang_products').doc(id).update(update);
    return { ok: true };
  }

  @Delete('products/:id')
  @UseGuards(JwtAuthGuard)
  async remove(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    const user = await this.usersService.findById(req.user.userId);
    if (!user?.isAdmin) throw new ForbiddenException();
    await this.firebase.collection('coupang_products').doc(id).delete();
    return { ok: true };
  }
}
