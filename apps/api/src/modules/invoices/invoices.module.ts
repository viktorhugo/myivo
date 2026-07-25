import { forwardRef, Module } from '@nestjs/common';
import { ExtractionModule } from '../extraction/extraction.module';
import { InvoicesController } from './invoices.controller';
import { FacturaRepository } from './factura.repository';
import { FileStorageService } from './file-storage.service';

@Module({
  imports: [forwardRef(() => ExtractionModule)],
  controllers: [InvoicesController],
  providers: [FacturaRepository, FileStorageService],
  exports: [FacturaRepository, FileStorageService],
})
export class InvoicesModule {}
