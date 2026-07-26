import { clasificarDocumento } from '../src/tax-rules/clasificacion-documento';

describe('clasificarDocumento', () => {
  it('clasifica como factura_electronica cuando hay CUFE', () => {
    const tipo = clasificarDocumento({
      cufe: 'abc123',
      comercioNombre: null,
      totalCentavos: null,
      items: [],
    });
    expect(tipo).toBe('factura_electronica');
  });

  it('el CUFE manda incluso si además faltan otros datos', () => {
    const tipo = clasificarDocumento({
      cufe: 'abc123',
      comercioNombre: null,
      totalCentavos: null,
      items: [],
    });
    expect(tipo).toBe('factura_electronica');
  });

  it('clasifica como documento_equivalente_pos sin CUFE pero con datos de compra (comercio)', () => {
    const tipo = clasificarDocumento({
      cufe: null,
      comercioNombre: 'Tienda D1',
      totalCentavos: null,
      items: [],
    });
    expect(tipo).toBe('documento_equivalente_pos');
  });

  it('clasifica como documento_equivalente_pos sin CUFE pero con total', () => {
    const tipo = clasificarDocumento({
      cufe: null,
      comercioNombre: null,
      totalCentavos: 50000,
      items: [],
    });
    expect(tipo).toBe('documento_equivalente_pos');
  });

  it('clasifica como documento_equivalente_pos sin CUFE pero con ítems', () => {
    const tipo = clasificarDocumento({
      cufe: null,
      comercioNombre: null,
      totalCentavos: null,
      items: [{ descripcion: 'Pan' }],
    });
    expect(tipo).toBe('documento_equivalente_pos');
  });

  it('clasifica como desconocido sin CUFE y sin ningún dato de compra', () => {
    const tipo = clasificarDocumento({
      cufe: null,
      comercioNombre: null,
      totalCentavos: null,
      items: [],
    });
    expect(tipo).toBe('desconocido');
  });
});
