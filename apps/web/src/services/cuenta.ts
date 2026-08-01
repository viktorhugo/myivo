import { API_BASE_URL, parsearRespuesta } from './invoices';

export interface IdentificacionesDto {
  identificaciones: string[];
}

export async function obtenerIdentificaciones(): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/cuenta/identificaciones`, { credentials: 'include' });
  const { identificaciones } = await parsearRespuesta<IdentificacionesDto>(response);
  return identificaciones;
}

/** Reemplaza la lista completa (US2, FR-007) — efecto inmediato en la próxima factura capturada. */
export async function actualizarIdentificaciones(identificaciones: string[]): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/cuenta/identificaciones`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identificaciones }),
  });
  const resultado = await parsearRespuesta<IdentificacionesDto>(response);
  return resultado.identificaciones;
}
