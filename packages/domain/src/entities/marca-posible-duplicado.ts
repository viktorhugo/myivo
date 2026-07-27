/** Cómo se detectó la coincidencia — data-model.md § Marca de Posible Duplicado, FR-019/FR-020. */
export type MetodoDeteccionDuplicado = 'cufe_exacto' | 'comercio_fecha_total_similar';

/**
 * `cufe_exacto` entra directo en `duplicado_confirmado` (FR-019: automático,
 * sin preguntar). `comercio_fecha_total_similar` entra en
 * `pendiente_confirmacion` y espera al usuario (FR-020).
 */
export type EstadoMarcaDuplicado = 'duplicado_confirmado' | 'pendiente_confirmacion' | 'confirmado_distinto';

/**
 * Relación entre dos facturas que el sistema considera la misma compra.
 * Ortogonal a `Factura.estado` (data-model.md): una factura puede estar
 * `extraída` y a la vez tener una marca de duplicado pendiente — el pipeline
 * de extracción y la resolución de duplicados no comparten máquina de estados.
 */
export interface MarcaPosibleDuplicado {
  id: string;
  facturaOriginalId: string;
  facturaCandidataId: string;
  metodoDeteccion: MetodoDeteccionDuplicado;
  estado: EstadoMarcaDuplicado;
  resueltoEn: Date | null;
  creadaEn: Date;
}
