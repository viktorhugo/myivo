/** Cómo se originó el registro — data-model.md § ValidacionDian. */
export type MetodoValidacionDian = 'manual' | 'conciliacion';

/**
 * Conjunto cerrado de resultados que el usuario puede reportar tras
 * consultar un CUFE en el portal de la DIAN (spec.md § Clarifications,
 * sesión 2026-07-28). La conciliación en lote (US2) siempre produce
 * `valido_vigente` — estar en el listado oficial de documentos recibidos
 * de la DIAN implica que el documento fue recibido y es válido.
 */
export type ResultadoValidacionDian =
  'valido_vigente' | 'no_encontrado' | 'anulado_reemplazado' | 'otro';

/**
 * Registro de auditoría de que el usuario (validación manual) o el proceso
 * de conciliación en lote confirmó el estado de un CUFE contra la fuente
 * oficial. Append-only (FR-010): una factura puede tener cero, una, o
 * varias a lo largo del tiempo — nunca se edita ni se borra una ya creada.
 *
 * El snapshot es una copia de los campos de `Factura` en el momento de la
 * validación, NUNCA datos leídos automáticamente del portal de la DIAN
 * (constitution Principio VI — ninguna automatización contra ese portal).
 * `ValidacionDian` MUST NOT alimentar `elegibilidadTributaria` ni
 * `tipoDocumento` de ninguna factura (constitution Principio IV) — es
 * información complementaria de auditoría, no una entrada del cálculo de
 * elegibilidad.
 */
export interface ValidacionDian {
  id: string;
  facturaId: string;
  metodo: MetodoValidacionDian;
  resultado: ResultadoValidacionDian;

  snapshotComercioNombre: string | null;
  snapshotTotalCentavos: number | null;
  snapshotMoneda: string;
  snapshotFechaHoraCompra: Date | null;
  /** El CUFE efectivamente validado, incluso si el usuario lo corrige después de este momento. */
  snapshotCufe: string;

  creadaEn: Date;
}
