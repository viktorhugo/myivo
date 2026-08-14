import { Module } from '@nestjs/common';
import { InvoicesModule } from '../invoices/invoices.module';
import { RecuperacionArranqueService } from './recuperacion-arranque.service';

/** US4 (specs/007-despliegue-produccion) — ver recuperacion-arranque.service.ts. */
@Module({
  imports: [InvoicesModule],
  providers: [RecuperacionArranqueService],
})
export class ArranqueModule {}
