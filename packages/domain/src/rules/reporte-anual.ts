/** Solo lo que el cálculo del reporte necesita de una Factura — no la entidad completa. */
export interface FacturaParaReporte {
  fechaHoraCompra: Date;
  totalCentavos: number;
  moneda: string;
}

export interface DesgloseMes {
  /** 1-12. */
  mes: number;
  totalCentavos: number;
  conteo: number;
}

export interface ReporteAnual {
  anio: number;
  totalCentavos: number;
  conteo: number;
  /** Siempre 12 posiciones, en orden — incluye los meses sin ninguna factura en $0 (FR-004). */
  desglosePorMes: DesgloseMes[];
}

const MONEDA_REPORTE = 'COP';

/**
 * Calcula el resumen anual (data-model.md § ReporteAnual): total, conteo, y
 * desglose de 12 meses, a partir de las facturas elegibles del año (ya
 * filtradas por rango de fecha y elegibilidad por el llamador — esta función
 * no vuelve a filtrar por año, confía en el conjunto recibido).
 *
 * Filtra a `moneda === 'COP'` porque FR-003 liga explícitamente "cuántas
 * facturas" a "ese total" (FR-002, FR-009) — a diferencia del Listado
 * general, aquí el conteo y el desglose son COP-only, igual que el total.
 */
export function calcularReporteAnual(anio: number, facturas: readonly FacturaParaReporte[]): ReporteAnual {
  const desglosePorMes: DesgloseMes[] = Array.from({ length: 12 }, (_valor, indice) => ({
    mes: indice + 1,
    totalCentavos: 0,
    conteo: 0,
  }));

  let totalCentavos = 0;
  let conteo = 0;

  for (const factura of facturas) {
    if (factura.moneda !== MONEDA_REPORTE) {
      continue;
    }

    const mesDelAno = desglosePorMes[factura.fechaHoraCompra.getMonth()];
    if (!mesDelAno) {
      continue;
    }
    mesDelAno.totalCentavos += factura.totalCentavos;
    mesDelAno.conteo += 1;
    totalCentavos += factura.totalCentavos;
    conteo += 1;
  }

  return { anio, totalCentavos, conteo, desglosePorMes };
}
