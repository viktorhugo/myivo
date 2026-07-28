import type { FacturaEstado } from '../state-machine/factura-estado';
import type { CampoConConfianza, MedioPago } from '../ports/invoice-extractor.port';
import type { TipoDocumento } from '../tax-rules/clasificacion-documento';

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
 * Campos de captura (US1) + extracción (US2) + clasificación tributaria
 * (US3) de `data-model.md`, más el soft-delete (`eliminadaEn`) de
 * specs/002-rediseno-visual-web User Story 2.
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

  /** `null` hasta que la extracción produce datos que clasificar (T038). */
  tipoDocumento: TipoDocumento | null;
  /** Siempre un valor CALCULADO (FR-016) — ninguna ruta de código distinta de la regla de elegibilidad lo asigna. */
  elegibilidadTributaria: boolean | null;
  /** Motivo cuando `elegibilidadTributaria = false` (FR-018); `null` cuando es elegible o aún no se calcula. */
  elegibilidadMotivo: string | null;

  creadaEn: Date;
  actualizadaEn: Date;

  /** Soft-delete (FR-009): no nulo significa que la factura MUST quedar excluida de toda lectura por defecto. */
  eliminadaEn: Date | null;
}
