import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import type { Env } from '../../config/env.schema';

@Injectable()
export class AuthService {
  constructor(private readonly configService: ConfigService<Env, true>) {}

  async validateCredentials(usuario: string, contraseña: string): Promise<boolean> {
    const expectedUsername = this.configService.get('AUTH_USERNAME', { infer: true });
    const passwordHash = this.configService.get('AUTH_PASSWORD_HASH', { infer: true });

    if (usuario !== expectedUsername) {
      return false;
    }

    return argon2.verify(passwordHash, contraseña);
  }
}
