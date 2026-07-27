import { validarExtraccion } from '../src/ports/invoice-extractor.port';

function datosValidos() {
  return {
    comercioNombre: 'Tienda D1',
    comercioNIT: '900123456',
    fechaHoraCompra: '2026-07-18T17:12:11.000Z',
    moneda: 'COP',
    subtotalCentavos: 10000,
    ivaPorTarifa: [{ tarifa: 19, valorCentavos: 1900 }],
    impuestoConsumoCentavos: null,
    propinaCentavos: null,
    totalCentavos: 11900,
    medioPago: 'efectivo',
    adquirienteNombre: null,
    adquirienteIdentificacion: null,
    cufeImpreso: null,
    items: [
      {
        descripcion: 'Pan',
        cantidad: 1,
        valorUnitarioCentavos: 10000,
        valorTotalCentavos: 10000,
        confianza: 0.9,
      },
    ],
    confianzaCampos: { comercioNombre: 0.9, totalCentavos: 0.95 },
  };
}

describe('validarExtraccion', () => {
  it('acepta datos completos válidos', () => {
    expect(() => validarExtraccion(datosValidos())).not.toThrow();
  });

  it('acepta confianzaCampos parcial — no exige las 12 claves presentes', () => {
    const datos = { ...datosValidos(), confianzaCampos: { totalCentavos: 0.95 } };
    const resultado = validarExtraccion(datos);
    expect(resultado.confianzaCampos).toEqual({ totalCentavos: 0.95 });
  });

  it('acepta confianzaCampos vacío', () => {
    const datos = { ...datosValidos(), confianzaCampos: {} };
    expect(() => validarExtraccion(datos)).not.toThrow();
  });

  it('rechaza una clave de confianzaCampos fuera del enum cerrado', () => {
    const datos = { ...datosValidos(), confianzaCampos: { totalCentabos: 0.9 } };
    expect(() => validarExtraccion(datos)).toThrow();
  });

  it('rechaza moneda vacía', () => {
    const datos = { ...datosValidos(), moneda: '' };
    expect(() => validarExtraccion(datos)).toThrow();
  });

  it('rechaza valorTotalCentavos no entero en un ítem', () => {
    const datos = datosValidos();
    datos.items[0]!.valorTotalCentavos = 100.5;
    expect(() => validarExtraccion(datos)).toThrow();
  });

  it('rechaza medioPago fuera del enum conocido', () => {
    const datos = { ...datosValidos(), medioPago: 'bitcoin' };
    expect(() => validarExtraccion(datos)).toThrow();
  });

  it('rechaza cuando falta un campo requerido del contrato', () => {
    const { moneda: _moneda, ...datosSinMoneda } = datosValidos();
    expect(() => validarExtraccion(datosSinMoneda)).toThrow();
  });
});
