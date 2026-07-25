import { forwardRef, Module } from '@nestjs/common';
import { InvoicesModule } from '../invoices/invoices.module';
import { ClaudeInvoiceExtractorAdapter } from './claude-invoice-extractor.adapter';
import { ExtractionProcessor } from './extraction.processor';
import { INVOICE_EXTRACTOR } from './invoice-extractor.token';

@Module({
  imports: [forwardRef(() => InvoicesModule)],
  providers: [
    { provide: INVOICE_EXTRACTOR, useClass: ClaudeInvoiceExtractorAdapter },
    ExtractionProcessor,
  ],
  exports: [ExtractionProcessor],
})
export class ExtractionModule {}
