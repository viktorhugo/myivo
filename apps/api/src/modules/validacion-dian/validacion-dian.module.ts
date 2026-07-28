import { Module } from '@nestjs/common';
import { InvoicesModule } from '../invoices/invoices.module';
import { ConciliacionDianController } from './conciliacion-dian.controller';
import { ConciliacionExcelService } from './conciliacion-excel.service';
import { ValidacionDianController } from './validacion-dian.controller';
import { ValidacionDianRepository } from './validacion-dian.repository';

/**
 * Módulo separado de `modules/invoices`, mismo criterio que `modules/extraction`:
 * responsabilidad de negocio distinta (validación externa contra la DIAN)
 * aunque opere sobre la misma entidad `Factura` — plan.md § Project Structure.
 * Importa `InvoicesModule` para `FacturaRepository` (conciliación en lote,
 * US2) — sin `forwardRef`, ya que `InvoicesModule` no depende de este módulo.
 */
@Module({
  imports: [InvoicesModule],
  controllers: [ValidacionDianController, ConciliacionDianController],
  providers: [ValidacionDianRepository, ConciliacionExcelService],
  exports: [ValidacionDianRepository],
})
export class ValidacionDianModule {}
