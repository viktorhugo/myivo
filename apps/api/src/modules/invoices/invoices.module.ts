import { forwardRef, Module } from '@nestjs/common';
import { ExtractionModule } from '../extraction/extraction.module';
import { InvoicesController } from './invoices.controller';
import { DuplicateMatchingService } from './duplicate-matching.service';
import { FacturaRepository } from './factura.repository';
import { FileStorageService } from './file-storage.service';
import { ImagenWebService } from './imagen-web.service';

@Module({
  imports: [forwardRef(() => ExtractionModule)],
  controllers: [InvoicesController],
  providers: [FacturaRepository, FileStorageService, DuplicateMatchingService, ImagenWebService],
  exports: [FacturaRepository, FileStorageService, DuplicateMatchingService],
})
export class InvoicesModule {}
