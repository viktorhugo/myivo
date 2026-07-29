import { z } from 'zod';

/** `GET /reportes/anual?anio=` (contracts/api.md) — `anio` requerido, entero. */
export const consultarReporteSchema = z.object({
  anio: z.coerce.number().int(),
});

export type ConsultarReporteQuery = z.infer<typeof consultarReporteSchema>;

/** `GET /reportes/anual/exportar?anio=&formato=` (contracts/api.md, US2) — sin default implícito de formato. */
export const exportarReporteSchema = z.object({
  anio: z.coerce.number().int(),
  formato: z.enum(['xlsx', 'pdf']),
});

export type ExportarReporteQuery = z.infer<typeof exportarReporteSchema>;
