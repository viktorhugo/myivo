import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { AUTH, type Auth } from '../auth';

/**
 * Reemplaza session-auth.guard.ts (single-user). Además de autenticar,
 * expone `usuarioId` en la request (contracts/api.md § Autenticación) — lo
 * usa tanto rls-transaction.interceptor.ts (T006, aísla vía Postgres RLS)
 * como los repositorios (T012-T015, aíslan explícitamente en cada query).
 */
@Injectable()
export class SessionUsuarioGuard implements CanActivate {
  constructor(@Inject(AUTH) private readonly auth: Auth) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const sesion = await this.auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!sesion) {
      return false;
    }

    request.usuarioId = sesion.user.id;
    return true;
  }
}
