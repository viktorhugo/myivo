import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { ReporteAnual } from '@myivo/domain';
import type { Response } from 'express';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { FacturaRepository } from '../invoices/factura.repository';
import { consultarReporteSchema, exportarReporteSchema } from './dto/consultar-reporte.dto';
import { ReporteAnualService } from './reporte-anual.service';
import { ReporteExcelService } from './reporte-excel.service';
import { ReportePdfService } from './reporte-pdf.service';

const CONTENT_TYPE_POR_FORMATO = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
} as const;

@Controller('reportes/anual')
@UseGuards(SessionAuthGuard)
export class ReportesController {
  constructor(
    private readonly reporteAnualService: ReporteAnualService,
    private readonly facturaRepository: FacturaRepository,
    private readonly reporteExcelService: ReporteExcelService,
    private readonly reportePdfService: ReportePdfService,
  ) {}

  /** Resumen del año elegido (FR-001/FR-002/FR-003/FR-004) — nunca 404, un año sin datos responde en ceros. */
  @Get()
  async consultar(@Query() query: unknown): Promise<ReporteAnual> {
    const { anio } = consultarReporteSchema.parse(query);
    const { resumen } = await this.reporteAnualService.calcular(anio);
    return resumen;
  }

  /** Año más antiguo con facturas capturadas, para poblar el selector (research.md § 4). */
  @Get('anios-disponibles')
  async aniosDisponibles(): Promise<{ anioMin: number | null }> {
    const anioMin = await this.facturaRepository.obtenerAnioMasAntiguo();
    return { anioMin };
  }

  /** Descarga el reporte del año elegido en el formato elegido (US2, FR-010) — sin default implícito de formato. */
  @Get('exportar')
  async exportar(@Query() query: unknown, @Res() res: Response): Promise<void> {
    const { anio, formato } = exportarReporteSchema.parse(query);
    const { resumen, facturas } = await this.reporteAnualService.calcular(anio);

    const buffer =
      formato === 'xlsx'
        ? await this.reporteExcelService.generar(resumen, facturas)
        : await this.reportePdfService.generar(resumen, facturas);

    res.setHeader('Content-Type', CONTENT_TYPE_POR_FORMATO[formato]);
    res.setHeader('Content-Disposition', `attachment; filename="reporte-renta-${anio}.${formato}"`);
    res.send(buffer);
  }
}
