/**
 * Regla de dominio pura: verifica que subtotal + IVA + impuesto al consumo +
 * propina cuadren contra el total extraído (FR-010). Nunca ajusta ningún
 * valor de forma silenciosa — solo informa si cuadra o no, para que el
 * orquestador decida la transición de estado (constitution Principio II).
 */

/** Umbral de confianza (0-1) bajo el cual un campo dispara revisión manual — ver spec.md § Assumptions. */
export const UMBRAL_CONFIANZA_BAJA = 0.7;

export interface ComponentesFactura {
  subtotalCentavos: number | null;
  ivaPorTarifa: readonly { valorCentavos: number }[];
  impuestoConsumoCentavos: number | null;
  propinaCentavos: number | null;
  totalCentavos: number | null;
}

export interface ResultadoCuadre {
  cuadra: boolean;
  /** `sumaComponentes - total`. Cero cuando cuadra. */
  diferenciaCentavos: number;
}

export function verificarCuadreMonetario(datos: ComponentesFactura): ResultadoCuadre {
  if (datos.totalCentavos === null) {
    return { cuadra: false, diferenciaCentavos: 0 };
  }

  const sumaIva = datos.ivaPorTarifa.reduce((acc, tarifa) => acc + tarifa.valorCentavos, 0);
  const sumaComponentes =
    (datos.subtotalCentavos ?? 0) +
    sumaIva +
    (datos.impuestoConsumoCentavos ?? 0) +
    (datos.propinaCentavos ?? 0);

  const diferenciaCentavos = sumaComponentes - datos.totalCentavos;
  return { cuadra: diferenciaCentavos === 0, diferenciaCentavos };
}
