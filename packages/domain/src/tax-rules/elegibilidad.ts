import type { MedioPago } from '../ports/invoice-extractor.port';
import type { TipoDocumento } from './clasificacion-documento';

export interface DatosParaElegibilidad {
  tipoDocumento: TipoDocumento;
  adquirienteIdentificacion: string | null;
  medioPago: MedioPago | null;
}

export interface ResultadoElegibilidad {
  elegible: boolean;
  /** `null` cuando `elegible = true` (FR-018: el motivo es solo para el caso "no elegible"). */
  motivo: string | null;
}

function normalizarIdentificacion(valor: string): string {
  return valor.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

/**
 * Compara identificaciones tolerando el dígito de verificación del NIT
 * colombiano (p. ej. "900123456" vs "900123456-1" extraído): si una es
 * exactamente un carácter más larga que la otra y comparte el prefijo, se
 * consideran la misma identificación.
 */
function identificacionCoincide(extraida: string, propias: readonly string[]): boolean {
  const normalizadaExtraida = normalizarIdentificacion(extraida);
  if (!normalizadaExtraida) {
    return false;
  }

  return propias.some((propia) => {
    const normalizadaPropia = normalizarIdentificacion(propia);
    if (!normalizadaPropia) {
      return false;
    }
    if (normalizadaExtraida === normalizadaPropia) {
      return true;
    }

    const [larga, corta] =
      normalizadaExtraida.length > normalizadaPropia.length
        ? [normalizadaExtraida, normalizadaPropia]
        : [normalizadaPropia, normalizadaExtraida];
    return larga.length === corta.length + 1 && larga.startsWith(corta);
  });
}

/**
 * Elegibilidad para la deducción del 1% en la declaración de renta
 * (constitution Principio IV: art. 336 del Estatuto Tributario colombiano).
 * Regla del año gravable 2026 (FR-015) — si cambia en años futuros,
 * versionar con un nombre nuevo (p. ej. `evaluarElegibilidad2027`) en vez de
 * mutar esta función; constitution Principio IV exige que las reglas
 * tributarias sean versionadas por año gravable, nunca reescritas con efecto
 * retroactivo silencioso.
 *
 * Elegible si y solo si (FR-015, en este orden — el primer motivo que
 * aplique es el que se reporta):
 * 1. El documento es una factura electrónica de venta (`tipoDocumento`).
 * 2. Está emitida a una de las identificaciones del usuario.
 * 3. El medio de pago es electrónico (cualquiera distinto de "efectivo").
 *
 * El sistema informa y organiza; NO emite concepto tributario (constitution
 * Principio IV) — ese aviso es responsabilidad de la UI (T040), no de esta
 * función.
 */
export function evaluarElegibilidad2026(
  datos: DatosParaElegibilidad,
  identificacionesPropias: readonly string[],
): ResultadoElegibilidad {
  if (datos.tipoDocumento !== 'factura_electronica') {
    const motivo =
      datos.tipoDocumento === 'documento_equivalente_pos'
        ? 'No elegible: es tiquete POS, no factura electrónica'
        : 'No elegible: no es una factura electrónica de venta';
    return { elegible: false, motivo };
  }

  const identificacionValida =
    datos.adquirienteIdentificacion !== null &&
    identificacionCoincide(datos.adquirienteIdentificacion, identificacionesPropias);
  if (!identificacionValida) {
    return { elegible: false, motivo: 'No elegible: la factura no está a tu nombre' };
  }

  if (datos.medioPago === null) {
    return { elegible: false, motivo: 'No elegible: no se pudo determinar el medio de pago' };
  }
  if (datos.medioPago === 'efectivo') {
    return { elegible: false, motivo: 'No elegible: pago en efectivo' };
  }

  return { elegible: true, motivo: null };
}
