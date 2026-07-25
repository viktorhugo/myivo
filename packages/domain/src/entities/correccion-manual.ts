/**
 * Registro de un campo editado por el usuario, diferenciado del valor
 * extraído — data-model.md § Corrección Manual, FR-011/FR-012.
 */
export interface CorreccionManual {
  id: string;
  facturaId: string;
  campo: string;
  valorExtraidoOriginal: string;
  valorCorregido: string;
  corregidoEn: Date;
}
