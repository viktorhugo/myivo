import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import sharp from 'sharp';
import {
  extractedInvoiceDataSchema,
  type ExtractedInvoiceData,
  type InvoiceExtractor,
} from '@myivo/domain';

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

export const MODELO_EXTRACCION = 'claude-sonnet-5';
export const VERSION_PROMPT_EXTRACCION = 'v1';

const MAX_TOKENS_SALIDA = 8192;

const SYSTEM_PROMPT = `Eres un asistente especializado en leer facturas y tiquetes de venta colombianos a partir de una foto, para un sistema de registro contable personal.

Reglas estrictas:
- Todos los valores monetarios son ENTEROS en CENTAVOS de peso (1 peso = 100 centavos). Si el documento muestra "$45.000", el valor es 4500000, no 45000. Nunca uses decimales.
- Si un campo no es legible o no aparece en la imagen, usa null. Nunca inventes ni estimes un valor que no puedas leer con certeza.
- "moneda" es el código ISO 4217 de 3 letras. Si no hay ninguna indicación de una moneda distinta, usa "COP".
- "fechaHoraCompra" en formato ISO 8601 (con hora si está visible; si no, solo la fecha). null si no es legible.
- "ivaPorTarifa" es un arreglo con una entrada por cada tarifa de IVA desglosada en el documento (p. ej. 19%, 5%), cada una con su "tarifa" (número, p. ej. 19) y su "valorCentavos".
- "medioPago" solo si aparece explícitamente en el documento, uno de: efectivo, tarjeta_debito, tarjeta_credito, transferencia_pse, billetera_digital. null si no es visible o no calza con ninguna opción.
- "cufeImpreso": transcribe un CUFE/CUDE SOLO si aparece como texto impreso (cadena alfanumérica larga, normalmente cerca de un código QR). Nunca intentes leer ni interpretar el código QR en sí — eso lo hace un proceso determinístico aparte. Si no hay CUFE impreso en texto, usa null.
- "items": una entrada por cada línea de producto o servicio, con su propia "confianza".
- "confianzaCampos": un número entre 0 y 1 por cada campo de nivel superior que sí hayas podido extraer (no lo incluyas si el valor es null), reflejando qué tan seguro estás de haberlo leído correctamente.
- Es una foto tomada con celular: puede estar inclinada, con reflejos, o parcialmente cortada. Ante la duda, reporta con menor confianza en vez de adivinar.`;

@Injectable()
export class ClaudeInvoiceExtractorAdapter implements InvoiceExtractor {
  private readonly client = new Anthropic();

  async extract(image: Buffer): Promise<ExtractedInvoiceData> {
    // Normaliza cualquier formato de entrada soportado por sharp (jpg/png/webp/
    // heic-si-el-build-lo-soporta) a JPEG, el formato que se envía a la API.
    // El archivo original en disco nunca se toca (constitution Principio I) —
    // esto es solo el buffer en memoria que viaja hacia Claude.
    const jpeg = await sharp(image).jpeg().toBuffer();

    const mensaje = await this.client.messages.parse({
      model: MODELO_EXTRACCION,
      max_tokens: MAX_TOKENS_SALIDA,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: jpeg.toString('base64') },
            },
            { type: 'text', text: 'Extrae los datos estructurados de esta factura o tiquete de compra.' },
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
