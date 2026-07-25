/** Línea de producto o servicio dentro de una Factura — data-model.md § Ítem de Factura. */
export interface ItemFactura {
  id: string;
  facturaId: string;
  descripcion: string | null;
  cantidad: number | null;
  valorUnitarioCentavos: number | null;
  valorTotalCentavos: number | null;
  nivelConfianza: number;
}
