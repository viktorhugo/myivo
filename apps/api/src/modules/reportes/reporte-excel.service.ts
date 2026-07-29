import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { ReporteAnual } from '@myivo/domain';
import type { FacturaConValidacion } from '../invoices/factura.repository';
import { NOTA_PRINCIPIO_IV, nombreMes } from './reporte-formato';

/**
 * Arma el `.xlsx` del reporte anual (US2, contracts/api.md): una hoja de
 * resumen (igual que la pantalla, COP-only — FR-002/FR-003/FR-009) y una
 * hoja con una fila por factura elegible del año, en cualquier moneda
 * (data-model.md § FilaExportacion — FR-010 no lleva el calificador COP-only
 * del resumen).
 */
@Injectable()
export class ReporteExcelService {
  async generar(resumen: ReporteAnual, facturas: readonly FacturaConValidacion[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    const hojaResumen = workbook.addWorksheet('Resumen');
    hojaResumen.addRow([`Reporte anual ${resumen.anio}`]);
    hojaResumen.addRow(['Total elegible (COP)', resumen.totalCentavos / 100]);
    hojaResumen.addRow(['Facturas (COP)', resumen.conteo]);
    hojaResumen.addRow([]);
    hojaResumen.addRow(['Mes', 'Total (COP)', 'Facturas']);
    for (const mesDelAno of resumen.desglosePorMes) {
      hojaResumen.addRow([nombreMes(mesDelAno.mes), mesDelAno.totalCentavos / 100, mesDelAno.conteo]);
    }
    hojaResumen.addRow([]);
    hojaResumen.addRow([NOTA_PRINCIPIO_IV]);

    const hojaFacturas = workbook.addWorksheet('Facturas');
    hojaFacturas.addRow(['Comercio', 'Fecha', 'Monto', 'Moneda', 'Tipo de documento', 'Validado DIAN']);
    for (const factura of facturas) {
      hojaFacturas.addRow([
        factura.comercioNombre ?? '—',
        factura.fechaHoraCompra ? factura.fechaHoraCompra.toISOString().slice(0, 10) : '—',
        factura.totalCentavos !== null ? factura.totalCentavos / 100 : null,
        factura.moneda,
        factura.tipoDocumento?.replace(/_/g, ' ') ?? '—',
        factura.ultimaValidacionDian !== null ? 'Sí' : 'No',
      ]);
    }

    // exceljs trae su propia copia de @types/node (Buffer no genérico),
    // distinta de la del monorepo — mismo Buffer real de Node en runtime
    // (mismo gotcha que conciliacion-excel.service.ts, en sentido inverso).
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
