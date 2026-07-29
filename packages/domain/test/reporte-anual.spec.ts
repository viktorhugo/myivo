import { calcularReporteAnual } from '../src/rules/reporte-anual';

describe('calcularReporteAnual', () => {
  it('devuelve los 12 meses en $0 cuando no hay ninguna factura', () => {
    const resultado = calcularReporteAnual(2026, []);
    expect(resultado.anio).toBe(2026);
    expect(resultado.totalCentavos).toBe(0);
    expect(resultado.conteo).toBe(0);
    expect(resultado.desglosePorMes).toHaveLength(12);
    expect(resultado.desglosePorMes.map((m) => m.mes)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(resultado.desglosePorMes.every((m) => m.totalCentavos === 0 && m.conteo === 0)).toBe(true);
  });

  it('suma una factura en el mes correcto', () => {
    const resultado = calcularReporteAnual(2026, [
      { fechaHoraCompra: new Date(2026, 2, 15), totalCentavos: 50000, moneda: 'COP' },
    ]);
    expect(resultado.totalCentavos).toBe(50000);
    expect(resultado.conteo).toBe(1);
    expect(resultado.desglosePorMes[2]).toEqual({ mes: 3, totalCentavos: 50000, conteo: 1 });
    expect(resultado.desglosePorMes.filter((m) => m.mes !== 3).every((m) => m.totalCentavos === 0)).toBe(true);
  });

  it('acumula varias facturas del mismo mes', () => {
    const resultado = calcularReporteAnual(2026, [
      { fechaHoraCompra: new Date(2026, 0, 5), totalCentavos: 10000, moneda: 'COP' },
      { fechaHoraCompra: new Date(2026, 0, 20), totalCentavos: 25000, moneda: 'COP' },
    ]);
    expect(resultado.desglosePorMes[0]).toEqual({ mes: 1, totalCentavos: 35000, conteo: 2 });
    expect(resultado.totalCentavos).toBe(35000);
    expect(resultado.conteo).toBe(2);
  });

  it('excluye facturas en moneda distinta a COP del total, conteo, y desglose (FR-009)', () => {
    const resultado = calcularReporteAnual(2026, [
      { fechaHoraCompra: new Date(2026, 4, 1), totalCentavos: 10000, moneda: 'COP' },
      { fechaHoraCompra: new Date(2026, 4, 2), totalCentavos: 999999, moneda: 'USD' },
    ]);
    expect(resultado.totalCentavos).toBe(10000);
    expect(resultado.conteo).toBe(1);
    expect(resultado.desglosePorMes[4]).toEqual({ mes: 5, totalCentavos: 10000, conteo: 1 });
  });

  it('la suma del desglose mensual siempre cuadra exactamente con el total y el conteo', () => {
    const facturas = [
      { fechaHoraCompra: new Date(2026, 0, 10), totalCentavos: 12000, moneda: 'COP' },
      { fechaHoraCompra: new Date(2026, 5, 10), totalCentavos: 34000, moneda: 'COP' },
      { fechaHoraCompra: new Date(2026, 11, 31), totalCentavos: 56000, moneda: 'COP' },
      { fechaHoraCompra: new Date(2026, 5, 15), totalCentavos: 999, moneda: 'EUR' },
    ];
    const resultado = calcularReporteAnual(2026, facturas);
    const sumaDesglose = resultado.desglosePorMes.reduce((acc, m) => acc + m.totalCentavos, 0);
    const conteoDesglose = resultado.desglosePorMes.reduce((acc, m) => acc + m.conteo, 0);
    expect(sumaDesglose).toBe(resultado.totalCentavos);
    expect(conteoDesglose).toBe(resultado.conteo);
  });
});
