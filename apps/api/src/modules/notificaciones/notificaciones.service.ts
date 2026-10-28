import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import type { Env } from '../../config/env.schema';

/**
 * Único punto de envío de correo fuera de Better Auth (que gestiona el suyo
 * propio para verificación — auth.ts). Útil para los flujos de borrado de
 * cuenta (cuenta-eliminacion.service.ts, purga-cuentas.service.ts), que no
 * pasan por un endpoint de Better Auth y por eso no pueden usar su hook
 * global `hooks.after`.
 */
@Injectable()
export class NotificacionesService {
  private readonly resend: Resend;
  private readonly remitente: string;

  constructor(configService: ConfigService<Env, true>) {
    this.resend = new Resend(configService.get('RESEND_API_KEY', { infer: true }));
    this.remitente = configService.get('EMAIL_FROM', { infer: true });
  }

  async enviarCorreo(destino: string, asunto: string, html: string): Promise<void> {
    await this.resend.emails.send({ from: this.remitente, to: destino, subject: asunto, html });
  }
}
