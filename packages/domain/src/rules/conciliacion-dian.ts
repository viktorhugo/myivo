/** Solo lo que la regla de conciliación necesita de una Factura — no la entidad completa. */
export interface FacturaConciliable {
  id: string;
  cufe: string;
}

export interface ResultadoConciliacion {
  /** Puede repetir un id si por algún motivo se le pasó dos veces en facturasCandidatas — el llamador no debería hacerlo, pero esta función no asume unicidad de entrada. */
  facturaIdsConciliadas: string[];
  /** CUFEs del documento que no corresponden a ninguna factura capturada — se ignoran, nunca crean una factura nueva (Edge Cases del spec). */
  cufesSinCoincidencia: string[];
}

/**
 * Concilia los CUFEs de un documento de conciliación (US2) contra las
 * facturas ya capturadas — data-model.md § Regla de dominio: conciliación en
 * lote. Coincidencia exacta de cadena, nunca difusa (a diferencia de la
 * detección de duplicados por comercio/fecha/total de 001/002, aquí ambos
 * lados son CUFEs, que deben coincidir carácter por carácter o no coinciden).
 *
 * Si dos facturas comparten el mismo CUFE (posible: la feature 001/002 ya
 * detecta y marca duplicados, pero no los fusiona automáticamente en todos
 * los casos), AMBAS se conciertan si ese CUFE aparece en el documento — cada
 * una es una candidata igual de válida, no se elige una arbitrariamente.
 * CUFEs repetidos dentro del propio documento se procesan una sola vez.
 */
export function conciliarCufes(
  cufesDelDocumento: readonly string[],
  facturasCandidatas: readonly FacturaConciliable[],
): ResultadoConciliacion {
  const facturaIdsPorCufe = new Map<string, string[]>();
  for (const factura of facturasCandidatas) {
    const existentes = facturaIdsPorCufe.get(factura.cufe);
    if (existentes) {
      existentes.push(factura.id);
    } else {
      facturaIdsPorCufe.set(factura.cufe, [factura.id]);
    }
  }

  const facturaIdsConciliadas: string[] = [];
  const cufesSinCoincidencia: string[] = [];

  for (const cufe of new Set(cufesDelDocumento)) {
    const idsCoincidentes = facturaIdsPorCufe.get(cufe);
    if (idsCoincidentes) {
      facturaIdsConciliadas.push(...idsCoincidentes);
    } else {
      cufesSinCoincidencia.push(cufe);
    }
  }

  return { facturaIdsConciliadas, cufesSinCoincidencia };
}
