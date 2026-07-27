import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import type { ExtractedInvoiceData, InvoiceExtractor } from '@myivo/domain';
import type { Env } from '../../config/env.schema';
import {
  EXTRACTION_SYSTEM_PROMPT_CON_SCHEMA,
  EXTRACTION_USER_MESSAGE,
  parsearJsonDeRespuesta,
} from './extraction-prompt';
import { decodificarImagen } from './image-decoder';

/**
 * Adaptador de `InvoiceExtractor` sobre Claude API — research.md § 3 y § 10.
 *
 * NO usa `output_config.format` (salida estructurada estricta): verificado
 * con una foto real (tiquete D1, 21 ítems) que la decodificación restringida
 * por JSON Schema se corta a mitad del arreglo de ítems — `stop_reason:
 * "end_turn"` pero el JSON queda sintácticamente incompleto, reproducible
 * incluso duplicando `max_tokens`. La MISMA extracción, pidiendo el JSON por
 * instrucción en el prompt en vez de por schema estricto, salió completa y
 * válida. Se usa ese enfoque aquí — igual que el adaptador genérico
 * compatible con OpenAI — confiando en que `validarExtraccion()` en el
 * orquestador (constitution Principio III) es la validación real de todos
 * modos, sin importar qué tan estricto sea el mecanismo de cada proveedor.
 *
 * Prompt caching (research.md § 3, T052): el system prompt (instrucciones +
 * schema JSON) es idéntico entre llamadas — solo cambia la imagen — así que
 * se marca con `cache_control` para que Anthropic lo sirva desde caché a
 * partir de la segunda llamada.
 */

// Generoso a propósito: el "thinking" adaptativo de Sonnet 5 puede consumir
// varios miles de tokens antes de escribir la respuesta (verificado: hasta
// ~7700 en una sola llamada), y una factura real puede tener muchos ítems.
const MAX_TOKENS_SALIDA = 16384;

@Injectable()
export class ClaudeInvoiceExtractorAdapter implements InvoiceExtractor {
  private readonly client: Anthropic;
  private readonly modelo: string;

  constructor(configService: ConfigService<Env, true>) {
    this.client = new Anthropic({ apiKey: configService.get('ANTHROPIC_API_KEY', { infer: true }) });
    this.modelo = configService.get('EXTRACTION_MODEL', { infer: true });
  }

  async extract(image: Buffer): Promise<ExtractedInvoiceData> {
    // Normaliza cualquier formato de entrada soportado (jpg/png/webp/heic) a
    // JPEG, el formato que se envía a la API. El archivo original en disco
    // nunca se toca (constitution Principio I) — esto es solo el buffer en
    // memoria que viaja hacia Claude.
    const jpeg = await (await decodificarImagen(image)).jpeg().toBuffer();

    const mensaje = await this.client.messages.create({
      model: this.modelo,
      max_tokens: MAX_TOKENS_SALIDA,
      system: [
        {
          type: 'text',
          text: EXTRACTION_SYSTEM_PROMPT_CON_SCHEMA,
          cache_control: { type: 'ephemeral' },
        },
      ],
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
    });

    const bloqueTexto = mensaje.content.find((bloque) => bloque.type === 'text');
    if (!bloqueTexto) {
      throw new Error('Claude no devolvió contenido de texto');
    }
    return parsearJsonDeRespuesta(bloqueTexto.text) as ExtractedInvoiceData;
  }
}
