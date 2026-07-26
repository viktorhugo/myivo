import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import sharp from 'sharp';
import {
  extractedInvoiceDataSchema,
  type ExtractedInvoiceData,
  type InvoiceExtractor,
} from '@myivo/domain';
import type { Env } from '../../config/env.schema';
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_USER_MESSAGE } from './extraction-prompt';

/**
 * Adaptador de `InvoiceExtractor` sobre Claude API — research.md § 3.
 * `output_config.format` (vía `zodOutputFormat`) en vez de `tool_use`: no hay
 * ninguna herramienta que el modelo decida invocar, siempre se quiere el
 * mismo objeto de vuelta con la misma forma.
 *
 * El prompt caching de research.md § 3 (`cache_control` sobre el system
 * prompt) es T052 (Polish) — no se implementa aquí para no adelantar una
 * tarea de otra fase.
 */

const MAX_TOKENS_SALIDA = 8192;

@Injectable()
export class ClaudeInvoiceExtractorAdapter implements InvoiceExtractor {
  private readonly client: Anthropic;
  private readonly modelo: string;

  constructor(configService: ConfigService<Env, true>) {
    this.client = new Anthropic({ apiKey: configService.get('ANTHROPIC_API_KEY', { infer: true }) });
    this.modelo = configService.get('EXTRACTION_MODEL', { infer: true });
  }

  async extract(image: Buffer): Promise<ExtractedInvoiceData> {
    // Normaliza cualquier formato de entrada soportado por sharp (jpg/png/webp/
    // heic-si-el-build-lo-soporta) a JPEG, el formato que se envía a la API.
    // El archivo original en disco nunca se toca (constitution Principio I) —
    // esto es solo el buffer en memoria que viaja hacia Claude.
    const jpeg = await sharp(image).jpeg().toBuffer();

    const mensaje = await this.client.messages.parse({
      model: this.modelo,
      max_tokens: MAX_TOKENS_SALIDA,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: jpeg.toString('base64') },
            },
            { type: 'text', text: EXTRACTION_USER_MESSAGE },
          ],
        },
      ],
      output_config: {
        format: zodOutputFormat(extractedInvoiceDataSchema),
      },
    });

    if (!mensaje.parsed_output) {
      throw new Error('Claude no devolvió una salida estructurada parseable');
    }
    return mensaje.parsed_output;
  }
}
