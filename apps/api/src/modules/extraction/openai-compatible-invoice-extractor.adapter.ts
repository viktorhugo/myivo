import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { z } from 'zod';
import sharp from 'sharp';
import { extractedInvoiceDataSchema, type ExtractedInvoiceData, type InvoiceExtractor } from '@myivo/domain';
import type { Env, ExtractionProvider } from '../../config/env.schema';
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_USER_MESSAGE } from './extraction-prompt';

/**
 * Adaptador genérico de `InvoiceExtractor` para proveedores que exponen una
 * API compatible con la de OpenAI (mismo formato de petición, cambia solo
 * `baseURL` y la API key) — research.md § 10. Cubre Z.ai/GLM, Qwen/DashScope
 * y Kimi/Moonshot con un solo archivo en vez de tres casi idénticos.
 *
 * A diferencia del adaptador nativo de OpenAI, usa `response_format:
 * json_object` (modo JSON básico) en vez de `zodResponseFormat`: el soporte
 * de JSON Schema estricto no está confirmado de forma uniforme en estos tres
 * proveedores. El schema completo se describe en el propio prompt, y el
 * orquestador vuelve a validar con `validarExtraccion()` sin importar el
 * adaptador (constitution Principio III) — la solidez del sistema no
 * depende de que este modo básico sea perfecto.
 *
 * Los `baseURL`/modelos de ejemplo de abajo son los vigentes en julio 2026
 * (research.md § 10) — estos proveedores cambian nombres de modelo con
 * frecuencia; `EXTRACTION_MODEL` siempre manda sobre cualquier valor por
 * defecto.
 */

interface PresetProveedorCompatible {
  baseURL: string;
  apiKeyEnvVar: 'ZAI_API_KEY' | 'QWEN_API_KEY' | 'KIMI_API_KEY';
}

const PRESETS: Partial<Record<ExtractionProvider, PresetProveedorCompatible>> = {
  zai: { baseURL: 'https://api.z.ai/api/paas/v4/', apiKeyEnvVar: 'ZAI_API_KEY' },
  // Endpoint internacional de DashScope — si tu cuenta de Alibaba Cloud es de
  // otra región (p. ej. EE.UU.), verifica el baseURL correcto en la consola.
  qwen: { baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', apiKeyEnvVar: 'QWEN_API_KEY' },
  kimi: { baseURL: 'https://api.moonshot.ai/v1', apiKeyEnvVar: 'KIMI_API_KEY' },
};

// Terceros que clonan la API de OpenAI suelen replicar la forma estable de
// hace tiempo (max_tokens), no necesariamente el rename reciente de OpenAI
// (max_completion_tokens) — más compatible para este adaptador genérico.
const MAX_TOKENS_SALIDA = 8192;

const RESPONSE_JSON_SCHEMA_TEXTO = JSON.stringify(z.toJSONSchema(extractedInvoiceDataSchema));

@Injectable()
export class OpenAICompatibleInvoiceExtractorAdapter implements InvoiceExtractor {
  private readonly client: OpenAI;
  private readonly modelo: string;

  constructor(configService: ConfigService<Env, true>) {
    const proveedor = configService.get('EXTRACTION_PROVIDER', { infer: true });
    const preset = PRESETS[proveedor];
    if (!preset) {
      throw new Error(
        `"${proveedor}" no tiene un preset de baseURL en OpenAICompatibleInvoiceExtractorAdapter`,
      );
    }

    this.client = new OpenAI({
      apiKey: configService.get(preset.apiKeyEnvVar, { infer: true }),
      baseURL: preset.baseURL,
    });
    this.modelo = configService.get('EXTRACTION_MODEL', { infer: true });
  }

  async extract(image: Buffer): Promise<ExtractedInvoiceData> {
    const jpeg = await sharp(image).jpeg().toBuffer();

    const completion = await this.client.chat.completions.create({
      model: this.modelo,
      max_tokens: MAX_TOKENS_SALIDA,
      messages: [
        {
          role: 'system',
          content: `${EXTRACTION_SYSTEM_PROMPT}\n\nResponde ÚNICAMENTE con un objeto JSON que cumpla exactamente este JSON Schema, sin texto ni comentarios antes o después:\n${RESPONSE_JSON_SCHEMA_TEXTO}`,
        },
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
      response_format: { type: 'json_object' },
    });

    const texto = completion.choices[0]?.message.content;
    if (!texto) {
      throw new Error('El proveedor no devolvió contenido de texto');
    }
    return JSON.parse(texto) as ExtractedInvoiceData;
  }
}
