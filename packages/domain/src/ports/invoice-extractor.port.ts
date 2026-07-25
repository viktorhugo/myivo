/**
 * Puerto de extracción de datos de facturas (constitution Principios III y V).
 * El dominio solo conoce esta interfaz; los adaptadores (p. ej. Claude API)
 * viven en la capa de infraestructura (apps/api).
 *
 * `extractedInvoiceDataSchema` es la fuente de verdad del contrato: los tipos
 * TS se derivan de él con `z.infer`. Es una segunda capa de validación,
 * independiente de cualquier validación de forma que ya haga el proveedor de
 * extracción (p. ej. structured output) — el dominio nunca confía en la
 * palabra de un adaptador concreto (constitution Principio III).
 */

import { z } from 'zod';

export const medioPagoSchema = z.enum([
  'efectivo',
  'tarjeta_debito',
  'tarjeta_credito',
  'transferencia_pse',
  'billetera_digital',
]);

export type MedioPago = z.infer<typeof medioPagoSchema>;

const confianzaSchema = z.number().min(0).max(1);

export const extractedItemSchema = z.object({
  descripcion: z.string().nullable(),
  cantidad: z.number().nullable(),
  valorUnitarioCentavos: z.number().int().nullable(),
  valorTotalCentavos: z.number().int().nullable(),
  confianza: confianzaSchema,
});

export type ExtractedItem = z.infer<typeof extractedItemSchema>;

export const extractedIvaTarifaSchema = z.object({
  tarifa: z.number(),
  valorCentavos: z.number().int(),
});

export type ExtractedIvaTarifa = z.infer<typeof extractedIvaTarifaSchema>;

/**
 * Claves válidas de `confianzaCampos` — un subconjunto cerrado, no un mapa
 * abierto. Sin esto, cada llamada podría nombrar las claves distinto (p. ej.
 * "total" una vez, "totalCentavos" otra), y ni el orquestador ni la UI de
 * corrección podrían mostrar el indicador de confianza de forma confiable.
 */
export const camposConConfianzaSchema = z.enum([
  'comercioNombre',
  'comercioNIT',
  'fechaHoraCompra',
  'moneda',
  'subtotalCentavos',
  'ivaPorTarifa',
  'impuestoConsumoCentavos',
  'propinaCentavos',
  'totalCentavos',
  'medioPago',
  'adquirienteNombre',
  'adquirienteIdentificacion',
]);

export type CampoConConfianza = z.infer<typeof camposConConfianzaSchema>;

export const extractedInvoiceDataSchema = z.object({
  comercioNombre: z.string().nullable(),
  comercioNIT: z.string().nullable(),
  /** ISO 8601. `null` si la extracción no pudo leerla (FR-025). */
  fechaHoraCompra: z.string().nullable(),
  moneda: z.string().min(1),
  subtotalCentavos: z.number().int().nullable(),
  ivaPorTarifa: z.array(extractedIvaTarifaSchema),
  impuestoConsumoCentavos: z.number().int().nullable(),
  propinaCentavos: z.number().int().nullable(),
  totalCentavos: z.number().int().nullable(),
  medioPago: medioPagoSchema.nullable(),
  adquirienteNombre: z.string().nullable(),
  adquirienteIdentificacion: z.string().nullable(),
  /**
   * CUFE/CUDE impreso en texto (no leído de QR). Es SOLO el respaldo de
   * FR-008 — el decodificador determinístico de QR (cufe-decoder.ts) es
   * siempre la fuente preferida; esto solo se usa cuando el QR es ilegible.
   */
  cufeImpreso: z.string().nullable(),
  items: z.array(extractedItemSchema),
  /**
   * Un nivel de confianza (0-1) por nombre de campo extraído (FR-009).
   * `partialRecord`, no `record`: solo trae entradas para los campos que sí
   * se extrajeron — `z.record` con una clave enum exige las 12 claves
   * siempre presentes, lo cual contradice "no incluir campos en null".
   */
  confianzaCampos: z.partialRecord(camposConConfianzaSchema, confianzaSchema),
});

export type ExtractedInvoiceData = z.infer<typeof extractedInvoiceDataSchema>;

/**
 * Valida la salida cruda de un `InvoiceExtractor` antes de que el dominio la
 * toque. Lanza `z.ZodError` si no cumple el contrato — el orquestador
 * (User Story 2) trata eso como fallo total de la extracción (FR-013).
 */
export function validarExtraccion(datos: unknown): ExtractedInvoiceData {
  return extractedInvoiceDataSchema.parse(datos);
}

export interface InvoiceExtractor {
  extract(image: Buffer): Promise<ExtractedInvoiceData>;
}
