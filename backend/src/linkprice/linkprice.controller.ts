import {
  Controller, Get, Post, Delete, Patch, Param, Body, Query,
  UseGuards, Request, ForbiddenException,
} from '@nestjs/common';
import { FieldValue } from 'firebase-admin/firestore';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { FirebaseService } from '../firebase/firebase.service';
import { UsersService } from '../users/users.service';

interface LinkpriceCreateDto {
  name: string;
  category: string;
  embedCode: string;
  linkUrl?: string;
}

interface LinkpriceUpdateDto {
  active?: boolean;
  name?: string;
  category?: string;
  embedCode?: string;
  linkUrl?: string;
}

function extractDimensions(embedCode: string): { width: number; height: number } {
  const widthMatch = embedCode.match(/width="(\d+)"/);
  const heightMatch = embedCode.match(/height="(\d+)"/);
  return {
    width: widthMatch ? parseInt(widthMatch[1]) : 300,
    height: heightMatch ? parseInt(heightMatch[1]) : 250,
  };
}

@Controller('linkprice')
export class LinkpriceController {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly usersService: UsersService,
  ) {}

  @Get('products')
  async findAll(@Query('category') category?: string) {
    const snap = await this.firebase
      .collection('linkprice_products')
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((p: Record<string, unknown>) => p['active'] !== false)
      .filter((p: Record<string, unknown>) => !category || category === 'all' || p['category'] === category);
  }

  @Get('products/all')
  @UseGuards(JwtAuthGuard)
  async findAllAdmin(@Request() req: { user: { sub: string } }) {
    if (!(await this.usersService.isAdminUser(req.user.sub))) throw new ForbiddenException();
    const snap = await this.firebase
      .collection('linkprice_products')
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  @Post('products')
  @UseGuards(JwtAuthGuard)
  async create(
    @Request() req: { user: { sub: string } },
    @Body() body: LinkpriceCreateDto,
  ) {
    if (!(await this.usersService.isAdminUser(req.user.sub))) throw new ForbiddenException();

    const { width, height } = extractDimensions(body.embedCode);
    const now = new Date();

    const doc = {
      name: body.name.trim(),
      category: body.category,
      embedCode: body.embedCode,
      linkUrl: body.linkUrl?.trim() || null,
      width,
      height,
      active: true,
      clicks: 0,
      createdAt: now.toISOString(),
    };

    const ref = await this.firebase.collection('linkprice_products').add(doc);
    return { id: ref.id, ...doc };
  }

  @Post('products/:id/click')
  async trackClick(@Param('id') id: string) {
    await this.firebase.collection('linkprice_products').doc(id).update({
      clicks: FieldValue.increment(1),
    });
    return { ok: true };
  }

  @Patch('products/:id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Request() req: { user: { sub: string } },
    @Param('id') id: string,
    @Body() body: LinkpriceUpdateDto,
  ) {
    if (!(await this.usersService.isAdminUser(req.user.sub))) throw new ForbiddenException();

    const update: Record<string, unknown> = {};
    if (typeof body.active === 'boolean') update['active'] = body.active;
    if (body.name?.trim()) update['name'] = body.name.trim();
    if (body.category?.trim()) update['category'] = body.category.trim();
    if (body.linkUrl !== undefined) update['linkUrl'] = body.linkUrl?.trim() || null;
    if (body.embedCode?.trim()) {
      const code = body.embedCode.trim();
      const { width, height } = extractDimensions(code);
      update['embedCode'] = code;
      update['width'] = width;
      update['height'] = height;
    }

    await this.firebase.collection('linkprice_products').doc(id).update(update);
    return { ok: true };
  }

  @Delete('products/:id')
  @UseGuards(JwtAuthGuard)
  async remove(
    @Request() req: { user: { sub: string } },
    @Param('id') id: string,
  ) {
    if (!(await this.usersService.isAdminUser(req.user.sub))) throw new ForbiddenException();
    await this.firebase.collection('linkprice_products').doc(id).delete();
    return { ok: true };
  }
}
