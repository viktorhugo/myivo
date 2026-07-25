import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { FacturaRepository } from './factura.repository';
import { FileStorageService } from './file-storage.service';

@Module({
  controllers: [InvoicesController],
  providers: [FacturaRepository, FileStorageService],
})
export class InvoicesModule {}
