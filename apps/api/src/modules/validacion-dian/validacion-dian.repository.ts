import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectTransaction } from '@nestjs-cls/transactional';
import type { MetodoValidacionDian, ResultadoValidacionDian, ValidacionDian } from '@myivo/domain';
import type { PrismaClient, ValidacionDian as ValidacionDianPrisma } from '@prisma/client';

function aDominio(fila: ValidacionDianPrisma): ValidacionDian {
  return {
    id: fila.id,
    facturaId: fila.facturaId,
    metodo: fila.metodo as MetodoValidacionDian,
    resultado: fila.resultado as ResultadoValidacionDian,
    snapshotComercioNombre: fila.snapshotComercioNombre,
    snapshotTotalCentavos: fila.snapshotTotalCentavos,
    snapshotMoneda: fila.snapshotMoneda,
    snapshotFechaHoraCompra: fila.snapshotFechaHoraCompra,
    snapshotCufe: fila.snapshotCufe,
    creadaEn: fila.creadaEn,
  };
}

@Injectable()
export class ValidacionDianRepository {
  // Ver el comentario en factura.repository.ts sobre @InjectTransaction().
  constructor(@InjectTransaction() private readonly prisma: PrismaClient) {}

  /**
   * Toma el snapshot de la Factura en este momento (data-model.md) — nunca
   * datos leídos del portal de la DIAN. Rechaza explícito (FR-005) si la
   * factura no existe, no es de esta cuenta, está eliminada, o no tiene CUFE
   * — nunca crea un registro sobre un CUFE que no existe.
   */
  async crear(
    facturaId: string,
    usuarioId: string,
    metodo: MetodoValidacionDian,
    resultado: ResultadoValidacionDian,
  ): Promise<ValidacionDian> {
    const factura = await this.prisma.factura.findFirst({
      where: { id: facturaId, usuarioId, eliminadaEn: null },
    });
    if (!factura) {
      throw new NotFoundException(`Factura ${facturaId} no encontrada`);
    }
    if (!factura.cufe) {
      throw new BadRequestException(
        `La factura ${facturaId} no tiene CUFE — no hay nada que validar contra la DIAN`,
      );
    }

    const fila = await this.prisma.validacionDian.create({
      data: {
        facturaId,
        metodo,
        resultado,
        snapshotComercioNombre: factura.comercioNombre,
        snapshotTotalCentavos: factura.totalCentavos,
        snapshotMoneda: factura.moneda,
        snapshotFechaHoraCompra: factura.fechaHoraCompra,
        snapshotCufe: factura.cufe,
      },
    });
    return aDominio(fila);
  }

  /** Historial completo (FR-010), más reciente primero — array vacío si nunca se validó o la factura no es de esta cuenta, no un error. */
  async listarPorFactura(facturaId: string, usuarioId: string): Promise<ValidacionDian[]> {
    const filas = await this.prisma.validacionDian.findMany({
      where: { facturaId, factura: { usuarioId } },
      orderBy: { creadaEn: 'desc' },
    });
    return filas.map(aDominio);
  }
}
