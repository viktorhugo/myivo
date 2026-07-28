import { conciliarCufes } from '../src/rules/conciliacion-dian';

describe('conciliarCufes', () => {
  it('concilia una factura cuyo CUFE aparece en el documento', () => {
    const resultado = conciliarCufes(['CUFE-1'], [{ id: 'f1', cufe: 'CUFE-1' }]);
    expect(resultado.facturaIdsConciliadas).toEqual(['f1']);
    expect(resultado.cufesSinCoincidencia).toEqual([]);
  });

  it('reporta sin coincidencia un CUFE del documento que no corresponde a ninguna factura', () => {
    const resultado = conciliarCufes(['CUFE-X'], [{ id: 'f1', cufe: 'CUFE-1' }]);
    expect(resultado.facturaIdsConciliadas).toEqual([]);
    expect(resultado.cufesSinCoincidencia).toEqual(['CUFE-X']);
  });

  it('no concilia una factura cuyo CUFE no está en el documento', () => {
    const resultado = conciliarCufes(['CUFE-2'], [{ id: 'f1', cufe: 'CUFE-1' }, { id: 'f2', cufe: 'CUFE-2' }]);
    expect(resultado.facturaIdsConciliadas).toEqual(['f2']);
  });

  it('exige coincidencia exacta de cadena, no difusa', () => {
    const resultado = conciliarCufes(['cufe-1'], [{ id: 'f1', cufe: 'CUFE-1' }]);
    expect(resultado.facturaIdsConciliadas).toEqual([]);
    expect(resultado.cufesSinCoincidencia).toEqual(['cufe-1']);
  });

  it('concilia todas las facturas que comparten el mismo CUFE, no solo una', () => {
    const resultado = conciliarCufes(
      ['CUFE-1'],
      [{ id: 'f1', cufe: 'CUFE-1' }, { id: 'f2', cufe: 'CUFE-1' }],
    );
    expect(resultado.facturaIdsConciliadas).toEqual(['f1', 'f2']);
  });

  it('procesa un CUFE repetido en el propio documento una sola vez', () => {
    const resultado = conciliarCufes(['CUFE-1', 'CUFE-1'], [{ id: 'f1', cufe: 'CUFE-1' }]);
    expect(resultado.facturaIdsConciliadas).toEqual(['f1']);
  });

  it('devuelve ambos arreglos vacíos si no hay CUFEs ni facturas', () => {
    const resultado = conciliarCufes([], []);
    expect(resultado.facturaIdsConciliadas).toEqual([]);
    expect(resultado.cufesSinCoincidencia).toEqual([]);
  });
});
