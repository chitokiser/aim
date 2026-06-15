import { Controller, Post, Get, Body, Query, UnauthorizedException, HttpCode, ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('telegram')
  async telegramAuth(@Body() data: Record<string, string>) {
    const isValid = this.authService.verifyTelegramAuth(data);
    if (!isValid) throw new UnauthorizedException('Invalid Telegram auth data');
    return this.authService.loginOrRegister(data);
  }

  @Post('miniapp')
  @HttpCode(200)
  async miniAppLogin(@Body() body: { initData: string }) {
    if (!body?.initData) throw new UnauthorizedException('Missing initData');
    const result = await this.authService.loginFromMiniApp(body.initData);
    if (!result) throw new UnauthorizedException('Invalid Mini App auth data');
    return result;
  }

  @Post('google')
  @HttpCode(200)
  async googleAuth(@Body() body: { idToken: string }) {
    if (!body?.idToken) throw new UnauthorizedException('Missing idToken');
    const result = await this.authService.loginFromGoogle(body.idToken);
    if (!result) throw new UnauthorizedException('Invalid Google token');
    return result;
  }

  @Get('bot-token')
  async exchangeBotToken(@Query('token') token: string) {
    if (!token) throw new UnauthorizedException('Missing token');
    const result = await this.authService.exchangeBotToken(token);
    if (!result) throw new UnauthorizedException('Invalid or expired token');
    return result;
  }

  @Post('bootstrap')
  @HttpCode(200)
  async bootstrap(
    @Body() body: { setupToken: string; firstName: string; username?: string; telegramId?: string },
  ) {
    if (!body?.setupToken || !body?.firstName) throw new UnauthorizedException('Missing required fields');
    const result = await this.authService.bootstrapAdmin(body);
    if (!result) throw new ForbiddenException('Bootstrap failed — invalid token or admin already exists');
    return result;
  }
}
