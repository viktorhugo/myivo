import { Injectable } from '@nestjs/common';
import { calcularReporteAnual, type FacturaParaReporte, type ReporteAnual } from '@myivo/domain';
import { FacturaRepository, type FacturaConValidacion } from '../invoices/factura.repository';

export interface DatosReporteAnual {
  resumen: ReporteAnual;
  /**
   * Todas las facturas elegibles del año, en cualquier moneda — a diferencia
   * de `resumen` (COP-only, FR-009), esta lista alimenta `FilaExportacion`
   * (US2, data-model.md), que no lleva ese calificador.
   */
  facturas: FacturaConValidacion[];
}

/**
 * Orquesta el cálculo del reporte anual (plan.md § Summary): trae las
 * facturas elegibles del año vía `FacturaRepository.listar()` (sin filtro de
 * moneda) y delega en `calcularReporteAnual` (dominio) el resumen COP-only.
 * Consumida tanto por la pantalla (US1) como por la exportación (US2).
 */
@Injectable()
export class ReporteAnualService {
  constructor(private readonly facturaRepository: FacturaRepository) {}

  async calcular(anio: number, usuarioId: string): Promise<DatosReporteAnual> {
    const { items } = await this.facturaRepository.listar(
      {
        fechaDesde: new Date(anio, 0, 1),
        fechaHasta: new Date(anio, 11, 31, 23, 59, 59, 999),
        elegibilidad: true,
      },
      usuarioId,
    );

    const facturasParaDominio: FacturaParaReporte[] = [];
    for (const factura of items) {
      // elegibilidadTributaria: true implica extracción completa (feature 001)
      // — se filtra de forma defensiva en vez de asumirlo con un cast.
      if (factura.fechaHoraCompra === null || factura.totalCentavos === null) {
        continue;
      }
      facturasParaDominio.push({
        fechaHoraCompra: factura.fechaHoraCompra,
        totalCentavos: factura.totalCentavos,
        moneda: factura.moneda,
      });
    }

    const resumen = calcularReporteAnual(anio, facturasParaDominio);
    return { resumen, facturas: items };
  }
}
