export type FacturaEstado =
  'recibida' | 'procesando' | 'extraída' | 'necesita_revisión' | 'fallida';

export type MedioPago =
  'efectivo' | 'tarjeta_debito' | 'tarjeta_credito' | 'transferencia_pse' | 'billetera_digital';

export type CufeOrigen = 'qr' | 'ocr_respaldo';

export type TipoDocumento =
  | 'factura_electronica'
  | 'documento_equivalente_pos'
  | 'documento_soporte'
  | 'otro'
  | 'desconocido';

export interface ArchivoDerivadoDto {
  ruta: string;
  tipoTransformacion: string;
  creadoEn: string;
}

export interface IvaTarifaDto {
  tarifa: number;
  valorCentavos: number;
}

export type ConfianzaCamposDto = Record<string, number>;

export interface FacturaDto {
  id: string;
  estado: FacturaEstado;
  rutaImagenOriginal: string;
  derivados: ArchivoDerivadoDto[];

  comercioNombre: string | null;
  comercioNIT: string | null;
  fechaHoraCompra: string | null;
  moneda: string;
  subtotalCentavos: number | null;
  ivaPorTarifa: IvaTarifaDto[];
  impuestoConsumoCentavos: number | null;
  propinaCentavos: number | null;
  totalCentavos: number | null;
  medioPago: MedioPago | null;
  adquirienteNombre: string | null;
  adquirienteIdentificacion: string | null;
  cufe: string | null;
  cufeOrigen: CufeOrigen | null;
  confianzaCampos: ConfianzaCamposDto;

  tipoDocumento: TipoDocumento | null;
  elegibilidadTributaria: boolean | null;
  elegibilidadMotivo: string | null;

  creadaEn: string;
  actualizadaEn: string;
}

export interface ItemFacturaDto {
  id: string;
  facturaId: string;
  descripcion: string | null;
  cantidad: number | null;
  valorUnitarioCentavos: number | null;
  valorTotalCentavos: number | null;
  nivelConfianza: number;
}

export interface CorreccionManualDto {
  id: string;
  facturaId: string;
  campo: string;
  valorExtraidoOriginal: string;
  valorCorregido: string;
  corregidoEn: string;
}

export interface FacturaDetalleDto extends FacturaDto {
  items: ItemFacturaDto[];
  correcciones: CorreccionManualDto[];
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

export interface FiltrosFacturaParams {
  fechaDesde?: string;
  fechaHasta?: string;
  comercio?: string;
  /** Pesos, no centavos — se convierte antes de mandarlo (la API sí trabaja en centavos). */
  montoMinPesos?: number;
  montoMaxPesos?: number;
  tipoDocumento?: TipoDocumento;
  elegibilidad?: boolean;
  estado?: FacturaEstado;
}

export interface ResultadoListadoDto {
  items: FacturaDto[];
  conteo: number;
  /** Centavos — solo incluye documentos en COP (FR-027). */
  sumaTotal: number;
}

export async function listarFacturas(filtros: FiltrosFacturaParams): Promise<ResultadoListadoDto> {
  const params = new URLSearchParams();
  if (filtros.fechaDesde) params.set('fechaDesde', filtros.fechaDesde);
  if (filtros.fechaHasta) params.set('fechaHasta', filtros.fechaHasta);
  if (filtros.comercio) params.set('comercio', filtros.comercio);
  if (filtros.montoMinPesos !== undefined) {
    params.set('montoMin', String(Math.round(filtros.montoMinPesos * 100)));
  }
  if (filtros.montoMaxPesos !== undefined) {
    params.set('montoMax', String(Math.round(filtros.montoMaxPesos * 100)));
  }
  if (filtros.tipoDocumento) params.set('tipoDocumento', filtros.tipoDocumento);
  if (filtros.elegibilidad !== undefined) params.set('elegibilidad', String(filtros.elegibilidad));
  if (filtros.estado) params.set('estado', filtros.estado);

  const response = await fetch(`${API_BASE_URL}/invoices?${params.toString()}`, {
    credentials: 'include',
  });
  return parsearRespuesta<ResultadoListadoDto>(response);
}

export async function obtenerFactura(id: string): Promise<FacturaDetalleDto> {
  const response = await fetch(`${API_BASE_URL}/invoices/${id}`, {
    credentials: 'include',
  });
  return parsearRespuesta<FacturaDetalleDto>(response);
}

export function urlImagenFactura(id: string): string {
  return `${API_BASE_URL}/invoices/${id}/image`;
}

export async function corregirCampoFactura(
  id: string,
  campo: string,
  valorCorregido: string,
): Promise<FacturaDetalleDto> {
  const response = await fetch(`${API_BASE_URL}/invoices/${id}/fields`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ campo, valorCorregido }),
  });
  return parsearRespuesta<FacturaDetalleDto>(response);
}

export async function reprocesarFactura(id: string): Promise<FacturaDto> {
  const response = await fetch(`${API_BASE_URL}/invoices/${id}/reprocess`, {
    method: 'POST',
    credentials: 'include',
  });
  return parsearRespuesta<FacturaDto>(response);
}
