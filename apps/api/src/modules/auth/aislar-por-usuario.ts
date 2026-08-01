import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapter } from '@nestjs-cls/transactional';
import type { PrismaTransactionalClient, PrismaTransactionOptions } from '@nestjs-cls/transactional-adapter-prisma';
import type { PrismaClient } from '@prisma/client';

/**
 * `TransactionHost<TransactionalAdapterPrisma>` (la clase concreta como tipo)
 * resuelve `.tx` a `never`: bajo `exactOptionalPropertyTypes`, la clase no
 * satisface estructuralmente `TransactionalAdapter<...>` por la misma razón
 * documentada en app.module.ts (choque de forma en `wrapWithNestedTransaction`,
 * no una incompatibilidad real). Construir el tipo del adaptador a mano, con
 * los helpers que sí exporta el paquete, evita depender de esa comprobación
 * estructural sobre la clase.
 */
export type PrismaTransactionalAdapter = TransactionalAdapter<
  PrismaClient,
  PrismaTransactionalClient,
  PrismaTransactionOptions
>;

/**
 * Abre una transacción y fija `app.usuario_id` dentro de ella (research.md §
 * 3) — compartido por rls-transaction.interceptor.ts (todo el ciclo de un
 * request) y extraction.processor.ts (que corre fire-and-forget, DESPUÉS de
 * que la respuesta HTTP ya se envió, así que nunca hereda la transacción del
 * interceptor y necesita abrir la suya propia). `is_local = true`: ver
 * rls-transaction.interceptor.ts para el porqué.
 */
export async function aislarPorUsuario<R>(
  txHost: TransactionHost<PrismaTransactionalAdapter>,
  usuarioId: string,
  fn: () => Promise<R>,
): Promise<R> {
  return txHost.withTransaction(async () => {
    await txHost.tx.$executeRaw`SELECT set_config('app.usuario_id', ${usuarioId}, true)`;
    return fn();
  });
}
