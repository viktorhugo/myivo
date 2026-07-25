import {
  esTransicionValida,
  transicionar,
  TransicionEstadoInvalidaError,
  type FacturaEstado,
} from '../src/state-machine/factura-estado';

describe('Máquina de estados de Factura', () => {
  const transicionesValidas: Array<[FacturaEstado, FacturaEstado]> = [
    ['recibida', 'procesando'],
    ['procesando', 'extraída'],
    ['procesando', 'necesita_revisión'],
    ['procesando', 'fallida'],
    ['necesita_revisión', 'extraída'],
    ['fallida', 'procesando'],
  ];

  const transicionesInvalidas: Array<[FacturaEstado, FacturaEstado]> = [
    ['recibida', 'extraída'],
    ['recibida', 'necesita_revisión'],
    ['recibida', 'fallida'],
    ['recibida', 'recibida'],
    ['extraída', 'procesando'],
    ['extraída', 'necesita_revisión'],
    ['extraída', 'fallida'],
    ['necesita_revisión', 'procesando'],
    ['necesita_revisión', 'fallida'],
    ['fallida', 'extraída'],
    ['fallida', 'necesita_revisión'],
  ];

  it.each(transicionesValidas)('permite %s -> %s', (desde, hacia) => {
    expect(esTransicionValida(desde, hacia)).toBe(true);
    expect(transicionar(desde, hacia)).toBe(hacia);
  });

  it.each(transicionesInvalidas)('rechaza %s -> %s', (desde, hacia) => {
    expect(esTransicionValida(desde, hacia)).toBe(false);
    expect(() => transicionar(desde, hacia)).toThrow(TransicionEstadoInvalidaError);
  });

  it('el error inválido conserva el estado de origen y destino', () => {
    try {
      transicionar('extraída', 'fallida');
      throw new Error('Se esperaba que transicionar lanzara un error');
    } catch (error) {
      expect(error).toBeInstanceOf(TransicionEstadoInvalidaError);
      const transicionError = error as TransicionEstadoInvalidaError;
      expect(transicionError.desde).toBe('extraída');
      expect(transicionError.hacia).toBe('fallida');
    }
  });
});
