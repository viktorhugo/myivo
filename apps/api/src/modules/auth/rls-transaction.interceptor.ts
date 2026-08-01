import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { Request } from 'express';
import { Observable, from, lastValueFrom } from 'rxjs';
import { aislarPorUsuario, type PrismaTransactionalAdapter } from './aislar-por-usuario';

/**
 * Envuelve cada request autenticado en una transacción de Prisma con
 * `app.usuario_id` fijado (aislar-por-usuario.ts, research.md § 3), para que
 * las políticas RLS (prisma/rls-policies.sql) puedan compararla.
 *
 * `is_local = true` (dentro de aislarPorUsuario) limita el valor a la
 * transacción actual (equivalente a SET LOCAL): con conexiones pooleadas,
 * fijarlo a nivel de sesión filtraría entre requests que reusen la misma
 * conexión física.
 *
 * next.handle() se resuelve DENTRO del callback de withTransaction (nunca
 * después) para que el controller y todos sus servicios/repositorios corran
 * en la misma transacción donde ya quedó fijado app.usuario_id — si se
 * resolviera afuera, la transacción ya habría terminado (y el valor local ya
 * no existiría) antes de que el resto del pipeline ejecute sus queries.
 */
@Injectable()
export class RlsTransactionInterceptor implements NestInterceptor {
  constructor(private readonly txHost: TransactionHost<PrismaTransactionalAdapter>) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const usuarioId = request.usuarioId;

    // Rutas sin sesión (p. ej. las de Better Auth para registro/login): nada
    // que aislar — ninguna tabla con RLS depende de esta request.
    if (!usuarioId) {
      return next.handle();
    }

    return from(aislarPorUsuario(this.txHost, usuarioId, () => lastValueFrom(next.handle())));
  }
}
