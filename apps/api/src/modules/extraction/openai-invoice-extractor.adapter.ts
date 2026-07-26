import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import sharp from 'sharp';
import {
  extractedInvoiceDataSchema,
  type ExtractedInvoiceData,
  type InvoiceExtractor,
} from '@myivo/domain';
import type { Env } from '../../config/env.schema';
import { EXTRACTION_SCHEMA_NAME, EXTRACTION_SYSTEM_PROMPT, EXTRACTION_USER_MESSAGE } from './extraction-prompt';

/**
 * Adaptador de `InvoiceExtractor` sobre OpenAI — research.md § 10.
 * `chat.completions.parse()` + `zodResponseFormat` da salida estructurada
 * estricta (JSON Schema), igual de rigurosa que la de Claude — mismo schema
 * Zod del dominio, sin duplicar el contrato por proveedor.
 */

const MAX_TOKENS_SALIDA = 8192;

@Injectable()
export class OpenAIInvoiceExtractorAdapter implements InvoiceExtractor {
  private readonly client: OpenAI;
  private readonly modelo: string;

  constructor(configService: ConfigService<Env, true>) {
    this.client = new OpenAI({ apiKey: configService.get('OPENAI_API_KEY', { infer: true }) });
    this.modelo = configService.get('EXTRACTION_MODEL', { infer: true });
  }

  async extract(image: Buffer): Promise<ExtractedInvoiceData> {
    const jpeg = await sharp(image).jpeg().toBuffer();

    const completion = await this.client.chat.completions.parse({
      model: this.modelo,
      max_completion_tokens: MAX_TOKENS_SALIDA,
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: EXTRACTION_USER_MESSAGE },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${jpeg.toString('base64')}` },
            },
          ],
        },
      ],
      response_format: zodResponseFormat(extractedInvoiceDataSchema, EXTRACTION_SCHEMA_NAME),
    });

    const datos = completion.choices[0]?.message.parsed;
    if (!datos) {
      throw new Error('OpenAI no devolvió una salida estructurada parseable');
    }
    return datos;
  }
}
