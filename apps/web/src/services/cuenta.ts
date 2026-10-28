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

interface EliminacionCuentaDto {
  eliminacionProgramadaPara: string;
}

/** specs/008-borrado-cuenta, FR-001 a FR-003: la cuenta queda inaccesible al instante al confirmar. */
export async function solicitarEliminacionCuenta(correoConfirmacion: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/cuenta/eliminacion`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correoConfirmacion }),
  });
  const { eliminacionProgramadaPara } = await parsearRespuesta<EliminacionCuentaDto>(response);
  return eliminacionProgramadaPara;
}

/** US2, FR-005 — `null` en una cuenta activa; una fecha si hay una eliminación programada en curso. */
export async function obtenerEstadoEliminacionCuenta(): Promise<string | null> {
  const response = await fetch(`${API_BASE_URL}/cuenta/eliminacion`, { credentials: 'include' });
  const { eliminacionProgramadaPara } = await parsearRespuesta<{ eliminacionProgramadaPara: string | null }>(
    response,
  );
  return eliminacionProgramadaPara;
}

/** US2, FR-005 — revierte sin pérdida de datos (D3 en research.md de specs/008-borrado-cuenta). */
export async function cancelarEliminacionCuenta(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/cuenta/eliminacion/cancelar`, {
    method: 'POST',
    credentials: 'include',
  });
  await parsearRespuesta(response);
}
