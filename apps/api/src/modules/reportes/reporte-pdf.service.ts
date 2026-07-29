import { Injectable } from '@nestjs/common';
import pdfMake from 'pdfmake';
import type { Content, TableCell } from 'pdfmake/interfaces';
import type { ReporteAnual } from '@myivo/domain';
import type { FacturaConValidacion } from '../invoices/factura.repository';
import { NOTA_PRINCIPIO_IV, nombreMes } from './reporte-formato';

/**
 * Fuente estándar PDF (una de las 14 "standard fonts" del propio formato
 * PDF) — no requiere embeber ningún archivo .ttf, consistente con el
 * objetivo de costo/dependencias mínimas (constitution Principio VII,
 * research.md § 1). Soporta acentos y "ñ" (WinAnsiEncoding).
 */
const FUENTES = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};

/** Arma el `.pdf` del reporte anual (US2) — mismo contenido que `ReporteExcelService`, otro formato. */
@Injectable()
export class ReportePdfService {
  async generar(resumen: ReporteAnual, facturas: readonly FacturaConValidacion[]): Promise<Buffer> {
    pdfMake.setFonts(FUENTES);

    const filasDesglose: TableCell[][] = resumen.desglosePorMes.map((mesDelAno) => [
      nombreMes(mesDelAno.mes),
      { text: formatearCop(mesDelAno.totalCentavos), alignment: 'right' },
      { text: String(mesDelAno.conteo), alignment: 'right' },
    ]);

    const filasFacturas: TableCell[][] = facturas.map((factura) => [
      factura.comercioNombre ?? '—',
      factura.fechaHoraCompra ? factura.fechaHoraCompra.toISOString().slice(0, 10) : '—',
      { text: factura.totalCentavos !== null ? formatearMonto(factura.totalCentavos, factura.moneda) : '—', alignment: 'right' },
      factura.tipoDocumento?.replace(/_/g, ' ') ?? '—',
      factura.ultimaValidacionDian !== null ? 'Sí' : 'No',
    ]);

    const content: Content[] = [
      { text: `Reporte anual ${resumen.anio}`, fontSize: 16, bold: true },
      { text: `Total elegible (COP): ${formatearCop(resumen.totalCentavos)}`, margin: [0, 8, 0, 0] },
      { text: `Facturas (COP): ${resumen.conteo}`, margin: [0, 2, 0, 8] },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto'],
          body: [[{ text: 'Mes', bold: true }, { text: 'Total (COP)', bold: true }, { text: 'Facturas', bold: true }], ...filasDesglose],
        },
      },
      { text: 'Facturas del año', fontSize: 13, bold: true, margin: [0, 16, 0, 6] },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto', 'auto', 'auto'],
          body: [
            [
              { text: 'Comercio', bold: true },
              { text: 'Fecha', bold: true },
              { text: 'Monto', bold: true },
              { text: 'Tipo de documento', bold: true },
              { text: 'Validado DIAN', bold: true },
            ],
            ...filasFacturas,
          ],
        },
      },
      { text: NOTA_PRINCIPIO_IV, fontSize: 8, italics: true, margin: [0, 16, 0, 0] },
    ];

    const documento = pdfMake.createPdf({
      content,
      defaultStyle: { font: 'Helvetica', fontSize: 9 },
      pageMargins: [30, 30, 30, 30],
    });
    return documento.getBuffer();
  }
}

function formatearCop(centavos: number): string {
  return formatearMonto(centavos, 'COP');
}

function formatearMonto(centavos: number, moneda: string): string {
  const valor = centavos / 100;
  const decimales = moneda === 'COP' ? 0 : 2;
  return `${new Intl.NumberFormat('es-CO', { minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(valor)} ${moneda}`;
}
