import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { AUTH, type Auth } from '../auth';

/**
 * specs/008-borrado-cuenta: únicas rutas que una cuenta con eliminación
 * programada puede seguir llamando (D2/D3 en research.md) — consultar el
 * estado y revertir. Cualquier otra ruta se trata como si no hubiera sesión.
 */
const RUTAS_PERMITIDAS_CON_ELIMINACION_PROGRAMADA = new Set([
  '/cuenta/eliminacion',
  '/cuenta/eliminacion/cancelar',
]);

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

    // specs/008-borrado-cuenta (D2): una cuenta con eliminación programada
    // queda inaccesible al instante para todo lo demás — constitution
    // Principio I v2.1.0, única excepción al soft-delete puro.
    const usuario = sesion.user as typeof sesion.user & { eliminacionProgramadaPara?: Date | null };
    const tieneEliminacionProgramada = usuario.eliminacionProgramadaPara != null;
    if (tieneEliminacionProgramada && !RUTAS_PERMITIDAS_CON_ELIMINACION_PROGRAMADA.has(request.path)) {
      return false;
    }

    request.usuarioId = sesion.user.id;
    return true;
  }
}
