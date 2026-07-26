import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import sharp from 'sharp';
import { extractedInvoiceDataSchema, type ExtractedInvoiceData, type InvoiceExtractor } from '@myivo/domain';
import type { Env } from '../../config/env.schema';
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_USER_MESSAGE } from './extraction-prompt';

/**
 * Adaptador de `InvoiceExtractor` sobre Google Gemini — research.md § 10.
 * `responseJsonSchema` se genera del mismo schema Zod del dominio vía
 * `z.toJSONSchema()` (nativo de Zod v4) — un solo schema, no uno por
 * proveedor. A diferencia de Claude/OpenAI, aquí no hay un helper que además
 * valide con Zod la respuesta — por eso el orquestador SIEMPRE vuelve a
 * validar con `validarExtraccion()` sin importar el adaptador (constitution
 * Principio III): si el dialecto de JSON Schema de Gemini interpreta algo
 * distinto (p. ej. nulables), esa segunda capa lo atrapa igual.
 */

const RESPONSE_JSON_SCHEMA = z.toJSONSchema(extractedInvoiceDataSchema);

@Injectable()
export class GeminiInvoiceExtractorAdapter implements InvoiceExtractor {
  private readonly client: GoogleGenAI;
  private readonly modelo: string;

  constructor(configService: ConfigService<Env, true>) {
    this.client = new GoogleGenAI({ apiKey: configService.get('GEMINI_API_KEY', { infer: true }) });
    this.modelo = configService.get('EXTRACTION_MODEL', { infer: true });
  }

  async extract(image: Buffer): Promise<ExtractedInvoiceData> {
    const jpeg = await sharp(image).jpeg().toBuffer();

    const response = await this.client.models.generateContent({
      model: this.modelo,
      contents: [
        { text: EXTRACTION_USER_MESSAGE },
        { inlineData: { data: jpeg.toString('base64'), mimeType: 'image/jpeg' } },
      ],
      config: {
        systemInstruction: EXTRACTION_SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseJsonSchema: RESPONSE_JSON_SCHEMA,
      },
    });

    const texto = response.text;
    if (!texto) {
      throw new Error('Gemini no devolvió contenido de texto');
    }
    return JSON.parse(texto) as ExtractedInvoiceData;
  }
}
