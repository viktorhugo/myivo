import { forwardRef, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { InvoiceExtractor } from '@myivo/domain';
import type { Env } from '../../config/env.schema';
import { InvoicesModule } from '../invoices/invoices.module';
import { ClaudeInvoiceExtractorAdapter } from './claude-invoice-extractor.adapter';
import { OpenAIInvoiceExtractorAdapter } from './openai-invoice-extractor.adapter';
import { GeminiInvoiceExtractorAdapter } from './gemini-invoice-extractor.adapter';
import { OpenAICompatibleInvoiceExtractorAdapter } from './openai-compatible-invoice-extractor.adapter';
import { EXTRACTION_CONCURRENCY_LIMITER } from './extraction-concurrency.token';
import { ExtractionProcessor } from './extraction.processor';
import { INVOICE_EXTRACTOR } from './invoice-extractor.token';
import { crearLimitador, type Limitador } from './limitador-concurrencia';

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
    case 'openrouter':
      return new OpenAICompatibleInvoiceExtractorAdapter(configService);
    case 'deepseek':
      // La API pública de DeepSeek todavía es solo texto (verificado
      // jul-2026 — su visión sigue en pruebas gray-scale, sin lanzamiento
      // general). Este extractor manda una foto de la factura: sin
      // soporte de imágenes no puede cumplir el contrato de
      // InvoiceExtractor, así que se rechaza acá en vez de arrancar con un
      // adaptador que fallaría (o alucinaría) en cada extracción real.
      // Para reactivarlo cuando DeepSeek lance visión: borra este case (el
      // preset ya está listo en openai-compatible-invoice-extractor.adapter.ts,
      // solo hace falta que caiga en la misma rama que zai/qwen/kimi).
      throw new Error(
        'EXTRACTION_PROVIDER="deepseek": su API pública todavía no soporta imágenes, no puede usarse para extraer facturas',
      );
  }
}

/** FR-011 (research.md § 4): limita cuántas extracciones corren a la vez — ver limitador-concurrencia.ts. */
function crearLimitadorConcurrencia(configService: ConfigService<Env, true>): Limitador {
  const concurrencia = configService.get('EXTRACTION_MAX_CONCURRENCY', { infer: true });
  return crearLimitador(concurrencia);
}

@Module({
  imports: [forwardRef(() => InvoicesModule)],
  providers: [
    {
      provide: INVOICE_EXTRACTOR,
      useFactory: crearExtractor,
      inject: [ConfigService],
    },
    {
      provide: EXTRACTION_CONCURRENCY_LIMITER,
      useFactory: crearLimitadorConcurrencia,
      inject: [ConfigService],
    },
    ExtractionProcessor,
  ],
  exports: [ExtractionProcessor],
})
export class ExtractionModule {}
