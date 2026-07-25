export type FacturaEstado =
  'recibida' | 'procesando' | 'extraída' | 'necesita_revisión' | 'fallida';

export interface ArchivoDerivadoDto {
  ruta: string;
  tipoTransformacion: string;
  creadoEn: string;
}

export interface FacturaDto {
  id: string;
  estado: FacturaEstado;
  rutaImagenOriginal: string;
  derivados: ArchivoDerivadoDto[];
  creadaEn: string;
  actualizadaEn: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

async function parsearRespuesta<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const cuerpo: { message?: string | string[] } | null = await response.json().catch(() => null);
    const mensaje = cuerpo?.message ?? `Error ${response.status}`;
    throw new Error(Array.isArray(mensaje) ? mensaje.join(', ') : mensaje);
  }
  return response.json() as Promise<T>;
}

export async function subirFacturas(archivos: File[]): Promise<FacturaDto[]> {
  const formData = new FormData();
  for (const archivo of archivos) {
    formData.append('files', archivo);
  }

  const response = await fetch(`${API_BASE_URL}/invoices`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  return parsearRespuesta<FacturaDto[]>(response);
}

export async function obtenerFactura(id: string): Promise<FacturaDto> {
  const response = await fetch(`${API_BASE_URL}/invoices/${id}`, {
    credentials: 'include',
  });
  return parsearRespuesta<FacturaDto>(response);
}

export function urlImagenFactura(id: string): string {
  return `${API_BASE_URL}/invoices/${id}/image`;
}
