import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectTransaction, TransactionHost } from '@nestjs-cls/transactional';
import type { PrismaClient } from '@prisma/client';
import { aislarPorUsuario, type PrismaTransactionalAdapter } from '../auth/aislar-por-usuario';
import { FacturaRepository } from '../invoices/factura.repository';

/**
 * US4 (specs/007-despliegue-produccion, FR-015/FR-016): al arrancar, ninguna
 * factura debe quedar indefinidamente en `procesando` por una interrupción
 * previa (reinicio, redespliegue, caída). Reutiliza exclusivamente la
 * transición `procesando -> fallida` ya definida en la máquina de estados
 * (packages/domain/src/state-machine/factura-estado.ts) — la misma que usa
 * el propio `catch` de ExtractionProcessor.procesar() ante cualquier error;
 * cero transiciones nuevas.
 *
 * `usuarios` no tiene RLS (data-model.md § Aislamiento a dos capas, solo
 * `facturas` y sus dependientes lo tienen) — listarlos es una lectura
 * directa. Por cada cuenta, el barrido de sus facturas atascadas sí corre
 * dentro de `aislarPorUsuario` (mismo helper que ya usa
 * ExtractionProcessor), respetando RLS igual que cualquier otra operación.
 */
@Injectable()
export class RecuperacionArranqueService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RecuperacionArranqueService.name);

  constructor(
    @InjectTransaction() private readonly prisma: PrismaClient,
    private readonly facturaRepository: FacturaRepository,
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const usuarios = await this.prisma.user.findMany({ select: { id: true } });

    for (const { id: usuarioId } of usuarios) {
      // Una cuenta con datos inconsistentes nunca debe impedir que el resto
      // se recupere, ni tumbar el arranque del sistema entero.
      try {
        await this.recuperarFacturasDeUsuario(usuarioId);
      } catch (error) {
        this.logger.error(
          `Recuperación al arranque falló para la cuenta ${usuarioId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  private async recuperarFacturasDeUsuario(usuarioId: string): Promise<void> {
    const atascadas = await aislarPorUsuario(this.txHost, usuarioId, () =>
      this.prisma.factura.findMany({
        where: { usuarioId, estado: 'procesando', eliminadaEn: null },
        select: { id: true },
      }),
    );

    for (const { id: facturaId } of atascadas) {
      await aislarPorUsuario(this.txHost, usuarioId, () =>
        this.facturaRepository.actualizarEstado(facturaId, usuarioId, 'fallida'),
      );

      // FR-016: registro estructurado del evento de recuperación —
      // data-model.md § Evento de recuperación al arranque. Es log, no una
      // tabla nueva: el requisito pide explícitamente "queda registrada en
      // el log del sistema", no en la base de datos.
      this.logger.warn({
        evento: 'recuperacion_arranque',
        facturaId,
        usuarioId,
        estadoOrigen: 'procesando',
        estadoDestino: 'fallida',
      });
    }
  }
}
