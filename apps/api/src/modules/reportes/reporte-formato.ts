/** Compartido entre `ReporteExcelService` y `ReportePdfService` — mismo contenido en ambos formatos (FR-010). */
export const NOTA_PRINCIPIO_IV =
  'Este reporte organiza información ya calculada por el sistema; no es un concepto tributario. ' +
  'Revísalo con tu contador antes de usarlo en tu declaración de renta.';

/** Nombre del mes (1-12) en español, sin depender de una fecha concreta — mismo criterio que apps/web/src/format.ts. */
export function nombreMes(mes: number): string {
  return new Date(2000, mes - 1, 1).toLocaleDateString('es-CO', { month: 'long' });
}
