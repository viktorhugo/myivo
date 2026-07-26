import { forwardRef, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { InvoiceExtractor } from '@myivo/domain';
import type { Env } from '../../config/env.schema';
import { InvoicesModule } from '../invoices/invoices.module';
import { ClaudeInvoiceExtractorAdapter } from './claude-invoice-extractor.adapter';
import { OpenAIInvoiceExtractorAdapter } from './openai-invoice-extractor.adapter';
import { GeminiInvoiceExtractorAdapter } from './gemini-invoice-extractor.adapter';
import { OpenAICompatibleInvoiceExtractorAdapter } from './openai-compatible-invoice-extractor.adapter';
import { ExtractionProcessor } from './extraction.processor';
import { INVOICE_EXTRACTOR } from './invoice-extractor.token';

/**
 * Decide, según `EXTRACTION_PROVIDER`, cuál adaptador concreto se inyecta
 * detrás del puerto `InvoiceExtractor` (FR-031, research.md § 10). El
 * anotado de retorno `InvoiceExtractor` (no `InvoiceExtractor | undefined`)
 * hace que TypeScript rechace el build si se agrega un proveedor al enum de
 * `env.schema.ts` sin añadir su rama aquí.
 */
function crearExtractor(configService: ConfigService<Env, true>): InvoiceExtractor {
  const proveedor = configService.get('EXTRACTION_PROVIDER', { infer: true });
  switch (proveedor) {
    case 'claude':
      return new ClaudeInvoiceExtractorAdapter(configService);
    case 'openai':
      return new OpenAIInvoiceExtractorAdapter(configService);
    case 'gemini':
      return new GeminiInvoiceExtractorAdapter(configService);
    case 'zai':
    case 'qwen':
    case 'kimi':
      return new OpenAICompatibleInvoiceExtractorAdapter(configService);
  }
}

@Module({
  imports: [forwardRef(() => InvoicesModule)],
  providers: [
    {
      provide: INVOICE_EXTRACTOR,
      useFactory: crearExtractor,
      inject: [ConfigService],
    },
    ExtractionProcessor,
  ],
  exports: [ExtractionProcessor],
})
export class ExtractionModule {}
