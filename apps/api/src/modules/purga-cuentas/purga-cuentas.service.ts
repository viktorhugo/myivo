import { Injectable, Logger } from '@nestjs/common';
import { InjectTransaction, TransactionHost } from '@nestjs-cls/transactional';
import type { PrismaClient } from '@prisma/client';
import { aislarPorUsuario, type PrismaTransactionalAdapter } from '../auth/aislar-por-usuario';
import { FileStorageService } from '../invoices/file-storage.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

/**
 * specs/008-borrado-cuenta (US3, D4-D6 en research.md): única vía por la que
 * un original se destruye de forma automatizada — constitution Principio I
 * v2.1.0. Invocado por `scripts/purgar-cuentas-eliminadas.ts` (comando
 * standalone, disparado por cron del sistema operativo — mismo patrón que
 * `scripts/backup-db.sh`), nunca por un scheduler en proceso.
 *
 * Mismo molde que RecuperacionArranqueService (arranque/recuperacion-arranque.service.ts):
 * un fallo en una cuenta nunca detiene la purga del resto.
 */
@Injectable()
export class PurgaCuentasService {
  private readonly logger = new Logger(PurgaCuentasService.name);

  constructor(
    @InjectTransaction() private readonly prisma: PrismaClient,
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly fileStorage: FileStorageService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  /** @returns cuántas cuentas se purgaron en esta corrida (para el log del cron). */
  async ejecutarPurga(): Promise<number> {
    const vencidas = await this.prisma.user.findMany({
      where: { eliminacionProgramadaPara: { lte: new Date() } },
      select: { id: true, email: true },
    });

    let purgadas = 0;
    for (const { id: usuarioId, email } of vencidas) {
      try {
        await this.purgarCuenta(usuarioId, email);
        purgadas += 1;
      } catch (error) {
        this.logger.error(
          `Purga de cuenta falló para ${usuarioId} — se reintenta en la próxima corrida (FR-010)`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
    return purgadas;
  }

  /**
   * D5 en research.md: archivos → Facturas → User, el único orden que no
   * viola la FK de `Factura.usuarioId` (sin `onDelete: Cascade`, deliberado
   * en schema.prisma). Idempotente de punta a punta (FR-010): cada paso es
   * seguro de repetir si una corrida anterior murió a mitad de camino.
   */
  private async purgarCuenta(usuarioId: string, email: string): Promise<void> {
    const facturas = await aislarPorUsuario(this.txHost, usuarioId, () =>
      this.prisma.factura.findMany({
        where: { usuarioId },
        select: { rutaImagenOriginal: true, derivados: true },
      }),
    );

    for (const factura of facturas) {
      await this.fileStorage.borrarArchivo(factura.rutaImagenOriginal);
      const derivados = factura.derivados as unknown as Array<{ ruta: string }>;
      for (const derivado of derivados) {
        await this.fileStorage.borrarArchivo(derivado.ruta);
      }
    }

    await aislarPorUsuario(this.txHost, usuarioId, () => this.prisma.factura.deleteMany({ where: { usuarioId } }));
    // Seguro ahora: ninguna Factura referencia ya a este usuarioId.
    await this.prisma.user.delete({ where: { id: usuarioId } });

    this.logger.warn({ evento: 'purga_cuenta_eliminada', usuarioId });
    // Confirmación final, aunque para este punto ya no haya nada que revertir —
    // es la única constancia escrita que el titular tiene de que se ejecutó.
    await this.notificaciones.enviarCorreo(
      email,
      'Tu cuenta de MyIvo fue eliminada definitivamente — MyIvo',
      '<p>Se venció la ventana de 30 días y tu cuenta de MyIvo, junto con todas tus facturas, se eliminó de forma irreversible.</p>',
    );
  }
}
