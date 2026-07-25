import type { FacturaEstado } from '../state-machine/factura-estado';

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

/**
 * Campos mínimos para User Story 1 (captura). El resto de campos de
 * data-model.md (comercio, montos, elegibilidad, CUFE, etc.) se agregan en
 * User Story 2 y 3, cuando existe extracción que los produzca.
 */
export interface Factura {
  id: string;
  estado: FacturaEstado;
  rutaImagenOriginal: string;
  derivados: ArchivoDerivado[];
  creadaEn: Date;
  actualizadaEn: Date;
}
