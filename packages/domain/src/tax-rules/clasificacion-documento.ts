import { z } from 'zod';

/**
 * Clasificación de tipo de documento — constitution Principio IV: taxonomía
 * cerrada, cálculo derivado y trazable, nunca escrito a mano por defecto.
 */
export const tipoDocumentoSchema = z.enum([
  'factura_electronica',
  'documento_equivalente_pos',
  'documento_soporte',
  'otro',
  'desconocido',
]);

export type TipoDocumento = z.infer<typeof tipoDocumentoSchema>;

export interface DatosParaClasificar {
  cufe: string | null;
  comercioNombre: string | null;
  totalCentavos: number | null;
  items: readonly { descripcion: string | null }[];
}

/**
 * El CUFE es, por definición legal, exclusivo de la factura electrónica de
 * venta — su sola presencia clasifica el documento (FR-014). Sin CUFE, la
 * extracción actual (constitution Principio III: el tipo de documento nunca
 * se le pregunta al LLM, es una regla determinística) no tiene una señal
 * confiable para distinguir "documento soporte" u "otro" de un tiquete POS
 * normal — se asume `documento_equivalente_pos` cuando hay datos de una
 * compra reconocible, y `desconocido` cuando prácticamente no se extrajo
 * nada. `documento_soporte` y `otro` quedan disponibles como corrección
 * manual (`PATCH /invoices/:id/fields`) cuando el usuario sabe que no
 * calzan en ninguno de los dos casos automáticos.
 */
export function clasificarDocumento(datos: DatosParaClasificar): TipoDocumento {
  if (datos.cufe) {
    return 'factura_electronica';
  }

  const hayDatosDeCompra =
    datos.comercioNombre !== null || datos.totalCentavos !== null || datos.items.length > 0;

  return hayDatosDeCompra ? 'documento_equivalente_pos' : 'desconocido';
}
