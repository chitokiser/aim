import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
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
}
