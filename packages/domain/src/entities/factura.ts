import type { FacturaEstado } from '../state-machine/factura-estado';
import type { CampoConConfianza, MedioPago } from '../ports/invoice-extractor.port';

/**
 * Un archivo derivado (compresión, recorte, corrección de perspectiva) nunca
 * reemplaza al original — constitution Principio I. Cada uno queda vinculado
 * a la Factura que lo originó.
 */
export interface ArchivoDerivado {
  ruta: string;
  tipoTransformacion: string;
  creadoEn: Date;
}

export interface IvaTarifa {
  tarifa: number;
  valorCentavos: number;
}

/** Origen del CUFE: por QR (siempre preferido) o por OCR de respaldo (confianza reducida) — FR-008. */
export type CufeOrigen = 'qr' | 'ocr_respaldo';

/** Nivel de confianza (0-1) de un campo extraído — solo trae entradas para los campos que se extrajeron (FR-009). */
export type ConfianzaCampos = Partial<Record<CampoConConfianza, number>>;

/**
 * Campos de captura (US1) + extracción (US2) de `data-model.md`. Los campos
 * de clasificación tributaria (`tipoDocumento`, `elegibilidadTributaria`,
 * `elegibilidadMotivo`) y el soft-delete (`eliminadaEn`) se agregan en
 * User Story 3 y 4/5 respectivamente, cuando exista lógica que los produzca.
 */
export interface Factura {
  id: string;
  estado: FacturaEstado;
  rutaImagenOriginal: string;
  derivados: ArchivoDerivado[];

  comercioNombre: string | null;
  comercioNIT: string | null;
  fechaHoraCompra: Date | null;
  moneda: string;
  subtotalCentavos: number | null;
  ivaPorTarifa: IvaTarifa[];
  impuestoConsumoCentavos: number | null;
  propinaCentavos: number | null;
  totalCentavos: number | null;
  medioPago: MedioPago | null;
  adquirienteNombre: string | null;
  adquirienteIdentificacion: string | null;
  cufe: string | null;
  cufeOrigen: CufeOrigen | null;
  confianzaCampos: ConfianzaCampos;

  creadaEn: Date;
  actualizadaEn: Date;
}
