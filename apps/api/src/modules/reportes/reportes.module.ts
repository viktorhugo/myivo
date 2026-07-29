import { Module } from '@nestjs/common';
import { InvoicesModule } from '../invoices/invoices.module';
import { ReportesController } from './reportes.controller';
import { ReporteAnualService } from './reporte-anual.service';
import { ReporteExcelService } from './reporte-excel.service';
import { ReportePdfService } from './reporte-pdf.service';

/**
 * Módulo separado de `modules/invoices`, mismo criterio que `modules/extraction`
 * y `modules/validacion-dian`: responsabilidad de negocio distinta (agregación
 * + exportación) aunque consuma la misma `FacturaRepository` (plan.md § Project
 * Structure). Importa `InvoicesModule` para `FacturaRepository` — sin
 * `forwardRef`, ya que `InvoicesModule` no depende de este módulo.
 */
@Module({
  imports: [InvoicesModule],
  controllers: [ReportesController],
  providers: [ReporteAnualService, ReporteExcelService, ReportePdfService],
})
export class ReportesModule {}
