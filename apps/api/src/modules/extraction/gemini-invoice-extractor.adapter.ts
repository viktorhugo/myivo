import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { extractedInvoiceDataSchema, type ExtractedInvoiceData, type InvoiceExtractor } from '@myivo/domain';
import type { Env } from '../../config/env.schema';
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_USER_MESSAGE, parsearJsonDeRespuesta } from './extraction-prompt';
import { decodificarImagen } from './image-decoder';

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

// Generoso a propósito — ver claude-invoice-extractor.adapter.ts: el
// razonamiento interno del modelo puede consumir varios miles de tokens
// antes de escribir la respuesta, y una factura real puede tener muchos
// ítems.
const MAX_OUTPUT_TOKENS = 16384;

@Injectable()
export class GeminiInvoiceExtractorAdapter implements InvoiceExtractor {
  private readonly client: GoogleGenAI;
  private readonly modelo: string;

  constructor(configService: ConfigService<Env, true>) {
    this.client = new GoogleGenAI({ apiKey: configService.get('GEMINI_API_KEY', { infer: true }) });
    this.modelo = configService.get('EXTRACTION_MODEL', { infer: true });
  }

  async extract(image: Buffer): Promise<ExtractedInvoiceData> {
    const jpeg = await (await decodificarImagen(image)).jpeg().toBuffer();

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
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      },
    });

    const texto = response.text;
    if (!texto) {
      throw new Error('Gemini no devolvió contenido de texto');
    }
    return parsearJsonDeRespuesta(texto) as ExtractedInvoiceData;
  }
}
