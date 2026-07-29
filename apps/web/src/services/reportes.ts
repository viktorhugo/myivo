import { API_BASE_URL, parsearRespuesta } from './invoices';

export interface DesgloseMesDto {
  mes: number;
  totalCentavos: number;
  conteo: number;
}

export interface ReporteAnualDto {
  anio: number;
  totalCentavos: number;
  conteo: number;
  desglosePorMes: DesgloseMesDto[];
}

/** Resumen del año elegido (FR-001/FR-002/FR-003/FR-004) — nunca falla por "año sin datos", responde en ceros. */
export async function consultarReporteAnual(anio: number): Promise<ReporteAnualDto> {
  const response = await fetch(`${API_BASE_URL}/reportes/anual?anio=${anio}`, {
    credentials: 'include',
  });
  return parsearRespuesta<ReporteAnualDto>(response);
}

/** Año de la factura más antigua capturada — el tope superior del selector (año en curso) se calcula localmente. */
export async function obtenerAnioMasAntiguo(): Promise<number | null> {
  const response = await fetch(`${API_BASE_URL}/reportes/anual/anios-disponibles`, {
    credentials: 'include',
  });
  const { anioMin } = await parsearRespuesta<{ anioMin: number | null }>(response);
  return anioMin;
}

export type FormatoExportacion = 'xlsx' | 'pdf';

/**
 * Descarga el reporte del año elegido (US2, FR-010) — el usuario elige el
 * formato en cada exportación, sin default. La respuesta exitosa es un
 * archivo binario, no JSON, así que no reusa `parsearRespuesta`.
 */
export async function exportarReporteAnual(anio: number, formato: FormatoExportacion): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/reportes/anual/exportar?anio=${anio}&formato=${formato}`,
    { credentials: 'include' },
  );
  if (!response.ok) {
    const cuerpo: { message?: string | string[] } | null = await response.json().catch(() => null);
    const mensaje = cuerpo?.message ?? `Error ${response.status}`;
    throw new Error(Array.isArray(mensaje) ? mensaje.join(', ') : mensaje);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `reporte-renta-${anio}.${formato}`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}
