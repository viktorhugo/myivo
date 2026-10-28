import { Module } from '@nestjs/common';
import { InvoicesModule } from '../invoices/invoices.module';
import { PurgaCuentasService } from './purga-cuentas.service';

/** specs/008-borrado-cuenta (US3) — ver purga-cuentas.service.ts. Mismo molde que ArranqueModule. */
@Module({
  imports: [InvoicesModule],
  providers: [PurgaCuentasService],
  exports: [PurgaCuentasService],
})
export class PurgaCuentasModule {}
