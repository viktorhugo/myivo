/**
 * Máquina de estados de Factura.estado — ver data-model.md § Máquina de Estados.
 * Ninguna transición ocurre fuera de aquí (constitution, sección
 * "Máquina de Estados del Documento"): las no listadas fallan explícitamente.
 */

export type FacturaEstado =
  'recibida' | 'procesando' | 'extraída' | 'necesita_revisión' | 'fallida';

const TRANSICIONES_PERMITIDAS: Readonly<Record<FacturaEstado, readonly FacturaEstado[]>> = {
  recibida: ['procesando'],
  procesando: ['extraída', 'necesita_revisión', 'fallida'],
  extraída: [],
  necesita_revisión: ['extraída'],
  fallida: ['procesando'],
};

export class TransicionEstadoInvalidaError extends Error {
  constructor(
    public readonly desde: FacturaEstado,
    public readonly hacia: FacturaEstado,
  ) {
    super(`Transición inválida de Factura.estado: "${desde}" -> "${hacia}"`);
    this.name = 'TransicionEstadoInvalidaError';
  }
}

export function esTransicionValida(desde: FacturaEstado, hacia: FacturaEstado): boolean {
  return TRANSICIONES_PERMITIDAS[desde].includes(hacia);
}

export function transicionar(desde: FacturaEstado, hacia: FacturaEstado): FacturaEstado {
  if (!esTransicionValida(desde, hacia)) {
    throw new TransicionEstadoInvalidaError(desde, hacia);
  }
  return hacia;
}
