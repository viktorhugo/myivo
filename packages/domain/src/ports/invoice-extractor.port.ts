/**
 * Puerto de extracción de datos de facturas (constitution Principios III y V).
 * El dominio solo conoce esta interfaz; los adaptadores (p. ej. Claude API)
 * viven en la capa de infraestructura (apps/api). El schema de validación
 * runtime (Zod) de `ExtractedInvoiceData` se agrega en User Story 2.
 */

export type MedioPago =
  'efectivo' | 'tarjeta_debito' | 'tarjeta_credito' | 'transferencia_pse' | 'billetera_digital';

export interface ExtractedItem {
  descripcion: string | null;
  cantidad: number | null;
  valorUnitarioCentavos: number | null;
  valorTotalCentavos: number | null;
  confianza: number;
}

export interface ExtractedIvaTarifa {
  tarifa: number;
  valorCentavos: number;
}

export interface ExtractedInvoiceData {
  comercioNombre: string | null;
  comercioNIT: string | null;
  /** ISO 8601. `null` si la extracción no pudo leerla (FR-025). */
  fechaHoraCompra: string | null;
  moneda: string;
  subtotalCentavos: number | null;
  ivaPorTarifa: ExtractedIvaTarifa[];
  impuestoConsumoCentavos: number | null;
  propinaCentavos: number | null;
  totalCentavos: number | null;
  medioPago: MedioPago | null;
  adquirienteNombre: string | null;
  adquirienteIdentificacion: string | null;
  items: ExtractedItem[];
  /** Un nivel de confianza (0-1) por nombre de campo extraído (FR-009). */
  confianzaCampos: Record<string, number>;
}

export interface InvoiceExtractor {
  extract(image: Buffer): Promise<ExtractedInvoiceData>;
}
