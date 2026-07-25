import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { loginSchema } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: unknown, @Req() req: Request): Promise<{ status: 'ok' }> {
    const { usuario, contraseña } = loginSchema.parse(body);
    const isValid = await this.authService.validateCredentials(usuario, contraseña);

    if (!isValid) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }

    req.session.authenticated = true;
    return { status: 'ok' };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Req() req: Request): Promise<{ status: 'ok' }> {
    return new Promise((resolve, reject) => {
      req.session.destroy((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({ status: 'ok' });
      });
    });
  }
}
