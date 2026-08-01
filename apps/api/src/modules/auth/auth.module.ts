import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';
import { PrismaService } from '../../prisma/prisma.service';
import { AUTH, crearAuth } from './auth';
import { CuentaController } from './cuenta.controller';
import { SessionUsuarioGuard } from './guards/session-usuario.guard';
import { UsuarioService } from './usuario.service';

// @Global(): SessionUsuarioGuard y UsuarioService los usan controllers de
// otros módulos (invoices, validacion-dian, reportes) vía @UseGuards()/DI —
// mismo patrón que PrismaModule (prisma.module.ts).
@Global()
@Module({
  controllers: [CuentaController],
  providers: [
    {
      provide: AUTH,
      useFactory: (prisma: PrismaService, configService: ConfigService<Env, true>) =>
        crearAuth(prisma, {
          RESEND_API_KEY: configService.get('RESEND_API_KEY', { infer: true }),
          BETTER_AUTH_SECRET: configService.get('BETTER_AUTH_SECRET', { infer: true }),
          BETTER_AUTH_URL: configService.get('BETTER_AUTH_URL', { infer: true }),
          EMAIL_FROM: configService.get('EMAIL_FROM', { infer: true }),
          WEB_ORIGIN: configService.get('WEB_ORIGIN', { infer: true }),
        }),
      inject: [PrismaService, ConfigService],
    },
    SessionUsuarioGuard,
    UsuarioService,
  ],
  exports: [AUTH, SessionUsuarioGuard, UsuarioService],
})
export class AuthModule {}
