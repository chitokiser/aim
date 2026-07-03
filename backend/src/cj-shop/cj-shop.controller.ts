import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query,
  UseGuards, Request, ForbiddenException,
} from '@nestjs/common';
import { CjShopService } from './cj-shop.service';
import { UsersService } from '../users/users.service';
import { LevelService } from '../level/level.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('cj-shop')
export class CjShopController {
  constructor(
    private readonly cjShopService: CjShopService,
    private readonly usersService: UsersService,
    private readonly levelService: LevelService,
  ) {}

  // ── Public ─────────────────────────────────────────────────────────────

  @Get('products')
  listActive() {
    return this.cjShopService.listActiveProducts();
  }

  @Get('products/:id')
  getProduct(@Param('id') id: string) {
    return this.cjShopService.getProduct(id);
  }

  @Get('featured')
  listFeatured() {
    return this.cjShopService.listFeaturedProducts();
  }

  @Post('orders')
  @UseGuards(JwtAuthGuard)
  createOrder(
    @Request() req: { user: { sub: string } },
    @Body() dto: { productId: string; quantity: number; shipping: { name: string; phone: string; address: string; detailAddress?: string; zip: string; country?: string }; expToUse?: number; selectedVid?: string },
  ) {
    return this.cjShopService.createOrder(req.user.sub, dto);
  }

  @Get('orders/my')
  @UseGuards(JwtAuthGuard)
  getMyOrders(@Request() req: { user: { sub: string } }) {
    return this.cjShopService.getMyOrders(req.user.sub);
  }

  @Get('my-exp')
  @UseGuards(JwtAuthGuard)
  async getMyExp(@Request() req: { user: { sub: string } }) {
    const exp = await this.levelService.getSpendableExp(req.user.sub);
    return { exp };
  }

  // ── Admin ──────────────────────────────────────────────────────────────

  @Get('admin/search')
  @UseGuards(JwtAuthGuard)
  async search(
    @Request() req: { user: { sub: string } },
    @Query('keyword') keyword: string,
    @Query('page') page?: string,
  ) {
    if (!(await this.usersService.isAdminUser(req.user.sub))) throw new ForbiddenException();
    return this.cjShopService.searchCjCatalog(keyword, page ? Number(page) : 1);
  }

  @Get('admin/products/:pid/detail')
  @UseGuards(JwtAuthGuard)
  async detail(@Request() req: { user: { sub: string } }, @Param('pid') pid: string) {
    if (!(await this.usersService.isAdminUser(req.user.sub))) throw new ForbiddenException();
    return this.cjShopService.getCjProductDetail(pid);
  }

  @Get('admin/products')
  @UseGuards(JwtAuthGuard)
  async listAll(@Request() req: { user: { sub: string } }) {
    if (!(await this.usersService.isAdminUser(req.user.sub))) throw new ForbiddenException();
    return this.cjShopService.listAllProducts();
  }

  @Post('admin/products')
  @UseGuards(JwtAuthGuard)
  async register(@Request() req: { user: { sub: string } }, @Body() dto: Record<string, unknown>) {
    if (!(await this.usersService.isAdminUser(req.user.sub))) throw new ForbiddenException();
    return this.cjShopService.registerProduct(dto as {
      cjProductId: string;
      variants: { vid: string; label: string; image?: string; cjPriceUsd: number }[];
      nameKo: string; images?: string[]; video?: string; description?: string; marginPercent?: number; category?: string;
    });
  }

  @Patch('admin/products/:id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Request() req: { user: { sub: string } },
    @Param('id') id: string,
    @Body() dto: Record<string, unknown>,
  ) {
    if (!(await this.usersService.isAdminUser(req.user.sub))) throw new ForbiddenException();
    return this.cjShopService.updateProduct(id, dto);
  }

  @Delete('admin/products/:id')
  @UseGuards(JwtAuthGuard)
  async remove(@Request() req: { user: { sub: string } }, @Param('id') id: string) {
    if (!(await this.usersService.isAdminUser(req.user.sub))) throw new ForbiddenException();
    return this.cjShopService.deleteProduct(id);
  }

  @Get('admin/orders')
  @UseGuards(JwtAuthGuard)
  async allOrders(@Request() req: { user: { sub: string } }) {
    if (!(await this.usersService.isAdminUser(req.user.sub))) throw new ForbiddenException();
    return this.cjShopService.getAllOrders();
  }

  @Patch('admin/orders/:id/refresh-status')
  @UseGuards(JwtAuthGuard)
  async refreshStatus(@Request() req: { user: { sub: string } }, @Param('id') id: string) {
    if (!(await this.usersService.isAdminUser(req.user.sub))) throw new ForbiddenException();
    return this.cjShopService.refreshOrderStatus(id);
  }

  @Patch('admin/orders/:id/complete')
  @UseGuards(JwtAuthGuard)
  async complete(
    @Request() req: { user: { sub: string } },
    @Param('id') id: string,
    @Body() dto: { trackNumber?: string; trackingProvider?: string },
  ) {
    if (!(await this.usersService.isAdminUser(req.user.sub))) throw new ForbiddenException();
    return this.cjShopService.completeOrder(id, dto?.trackNumber, dto?.trackingProvider);
  }

  @Get('admin/balance')
  @UseGuards(JwtAuthGuard)
  async balance(@Request() req: { user: { sub: string } }) {
    if (!(await this.usersService.isAdminUser(req.user.sub))) throw new ForbiddenException();
    return this.cjShopService.getCjBalance();
  }
}
