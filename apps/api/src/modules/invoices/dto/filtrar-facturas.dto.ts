import { z } from 'zod';
import { tipoDocumentoSchema } from '@myivo/domain';

const facturaEstadoSchema = z.enum([
  'recibida',
  'procesando',
  'extraída',
  'necesita_revisión',
  'fallida',
]);

/**
 * Filtros de `GET /invoices` (FR-022, contracts/api.md) — todos opcionales y
 * combinables. Los montos van en centavos, igual que el resto de la API
 * (`PATCH /invoices/:id/fields`) — la conversión desde pesos es
 * responsabilidad del cliente.
 */
export const filtrarFacturasSchema = z.object({
  fechaDesde: z.coerce.date().optional(),
  fechaHasta: z.coerce.date().optional(),
  comercio: z.string().min(1).optional(),
  montoMin: z.coerce.number().int().optional(),
  montoMax: z.coerce.number().int().optional(),
  tipoDocumento: tipoDocumentoSchema.optional(),
  elegibilidad: z
    .enum(['true', 'false'])
    .transform((valor) => valor === 'true')
    .optional(),
  estado: facturaEstadoSchema.optional(),
});

export type FiltrosFactura = z.infer<typeof filtrarFacturasSchema>;
