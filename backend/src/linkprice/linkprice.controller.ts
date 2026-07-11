import {
  Controller, Get, Post, Delete, Patch, Param, Body, Query,
  UseGuards, Request, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { FieldValue } from 'firebase-admin/firestore';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { FirebaseService } from '../firebase/firebase.service';
import { UsersService } from '../users/users.service';

interface LinkpriceCreateDto {
  name: string;
  category: string;
  // Either an ad-network embed snippet (rendered in a sandboxed iframe), or
  // a plain thumbnail + deep-link (imageUrl + linkUrl) — at least one of the
  // two forms is required.
  embedCode?: string;
  imageUrl?: string;
  linkUrl?: string;
}

interface LinkpriceUpdateDto {
  active?: boolean;
  name?: string;
  category?: string;
  embedCode?: string;
  imageUrl?: string;
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

// Some ad networks (e.g. LinkPrice deep-link banners) hand out a plain
// `<a href="click.php?...">` wrapping an `<img>`, plus a separate 1x1
// tracking-pixel `<img>` — not a real ad-box embed like an <iframe>/<script>
// snippet. That pair renders fine as a plain <a><img></a>, so instead of
// making the admin split it into separate image/link inputs, pull the banner
// image + click link out of it automatically when the pasted code has no
// <iframe>/<script> (i.e. it isn't a real embeddable widget).
function parseDeepLinkEmbed(embedCode: string): { imageUrl: string; linkUrl: string } | null {
  if (/<iframe\b/i.test(embedCode) || /<script\b/i.test(embedCode)) return null;
  const anchorMatch = embedCode.match(/<a\b[^>]*\bhref\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
  if (!anchorMatch) return null;
  const [, href, innerHtml] = anchorMatch;
  const imgMatch = innerHtml.match(/<img\b[^>]*\bsrc\s*=\s*"([^"]+)"/i);
  if (!imgMatch) return null;
  return { imageUrl: imgMatch[1], linkUrl: href };
}

// The raw <a><img> snippet also frequently gets pasted into the "image URL"
// input by mistake (it's the field that visually maps to "the picture"), not
// just the embed-code field — same parser applies to either.
function looksLikeHtml(value: string): boolean {
  return /<a\b/i.test(value) || /<img\b/i.test(value);
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

    let embedCode = body.embedCode?.trim() || null;
    let imageUrl = body.imageUrl?.trim() || null;
    let linkUrl = body.linkUrl?.trim() || null;

    // Admin pasted a raw <a><img> deep-link snippet into the embed field
    // instead of a real ad-box widget — auto-split it into image + link so
    // it doesn't need to go through the sandboxed-iframe rendering path.
    if (embedCode && !(imageUrl && linkUrl)) {
      const parsed = parseDeepLinkEmbed(embedCode);
      if (parsed) {
        imageUrl = parsed.imageUrl;
        linkUrl = parsed.linkUrl;
        embedCode = null;
      }
    }

    // Same snippet, pasted into the image-URL field instead — the parsed
    // pair (image + its own link) overrides whatever was in either field,
    // since the snippet is self-consistent and takes priority over stray data.
    if (imageUrl && looksLikeHtml(imageUrl)) {
      const parsed = parseDeepLinkEmbed(imageUrl);
      if (parsed) {
        imageUrl = parsed.imageUrl;
        linkUrl = parsed.linkUrl;
      }
    }

    if (!embedCode && !(imageUrl && linkUrl)) {
      throw new BadRequestException('Provide either an embed code, or both an image URL and a link URL.');
    }
    const { width, height } = embedCode ? extractDimensions(embedCode) : { width: 300, height: 250 };
    const now = new Date();

    const doc = {
      name: body.name.trim(),
      category: body.category,
      embedCode,
      imageUrl,
      linkUrl,
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
    if (body.imageUrl !== undefined) update['imageUrl'] = body.imageUrl?.trim() || null;

    // Same fix as create(): a raw <a><img> snippet pasted into the image-URL
    // field gets auto-split into its real image + link, overriding whatever
    // was submitted for either field.
    if (typeof update['imageUrl'] === 'string' && looksLikeHtml(update['imageUrl'])) {
      const parsed = parseDeepLinkEmbed(update['imageUrl']);
      if (parsed) {
        update['imageUrl'] = parsed.imageUrl;
        update['linkUrl'] = parsed.linkUrl;
      }
    }

    if (body.embedCode?.trim()) {
      const code = body.embedCode.trim();
      const parsed = body.imageUrl === undefined && body.linkUrl === undefined ? parseDeepLinkEmbed(code) : null;
      if (parsed) {
        update['embedCode'] = null;
        update['imageUrl'] = parsed.imageUrl;
        update['linkUrl'] = parsed.linkUrl;
        update['width'] = extractDimensions(code).width;
        update['height'] = extractDimensions(code).height;
      } else {
        const { width, height } = extractDimensions(code);
        update['embedCode'] = code;
        update['width'] = width;
        update['height'] = height;
      }
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
