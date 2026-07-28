import { API_BASE_URL, parsearRespuesta, type ResultadoValidacionDian } from './invoices';

export interface ValidacionDianDto {
  id: string;
  facturaId: string;
  metodo: 'manual' | 'conciliacion';
  resultado: ResultadoValidacionDian;
  snapshotComercioNombre: string | null;
  snapshotTotalCentavos: number | null;
  snapshotMoneda: string;
  snapshotFechaHoraCompra: string | null;
  snapshotCufe: string;
  creadaEn: string;
}

/**
 * Enlace de consulta oficial con el CUFE precargado (research.md § 1,
 * specs/003-validacion-dian) — se construye enteramente aquí, sin ningún
 * endpoint de backend: ninguna llamada de red de este sistema llega jamás a
 * la DIAN (constitution Principio VI).
 */
export function construirEnlaceDian(cufe: string): string {
  return `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${encodeURIComponent(cufe)}`;
}

export async function registrarValidacionDian(
  facturaId: string,
  resultado: ResultadoValidacionDian,
): Promise<ValidacionDianDto> {
  const response = await fetch(`${API_BASE_URL}/invoices/${facturaId}/validaciones-dian`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resultado }),
  });
  return parsearRespuesta<ValidacionDianDto>(response);
}

/** Historial completo (FR-010), más reciente primero — array vacío si nunca se validó. */
export async function listarValidacionesDian(facturaId: string): Promise<ValidacionDianDto[]> {
  const response = await fetch(`${API_BASE_URL}/invoices/${facturaId}/validaciones-dian`, {
    credentials: 'include',
  });
  return parsearRespuesta<ValidacionDianDto[]>(response);
}

export interface ResumenConciliacionDianDto {
  facturasConciliadas: number;
  cufesSinCoincidencia: number;
}

/** Conciliación en lote (US2) — un único archivo .xlsx tal cual lo exporta la DIAN. */
export async function conciliarDian(archivo: File): Promise<ResumenConciliacionDianDto> {
  const formData = new FormData();
  formData.append('archivo', archivo);

  const response = await fetch(`${API_BASE_URL}/invoices/dian-conciliacion`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  return parsearRespuesta<ResumenConciliacionDianDto>(response);
}
