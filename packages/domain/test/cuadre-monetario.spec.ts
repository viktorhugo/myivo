import { verificarCuadreMonetario } from '../src/tax-rules/cuadre-monetario';

describe('verificarCuadreMonetario', () => {
  it('cuadra cuando subtotal + IVA + consumo + propina == total', () => {
    const resultado = verificarCuadreMonetario({
      subtotalCentavos: 100_000,
      ivaPorTarifa: [{ valorCentavos: 19_000 }],
      impuestoConsumoCentavos: 0,
      propinaCentavos: 10_000,
      totalCentavos: 129_000,
    });
    expect(resultado).toEqual({ cuadra: true, diferenciaCentavos: 0 });
  });

  it('suma varias tarifas de IVA', () => {
    const resultado = verificarCuadreMonetario({
      subtotalCentavos: 100_000,
      ivaPorTarifa: [{ valorCentavos: 19_000 }, { valorCentavos: 5_000 }],
      impuestoConsumoCentavos: 0,
      propinaCentavos: 0,
      totalCentavos: 124_000,
    });
    expect(resultado).toEqual({ cuadra: true, diferenciaCentavos: 0 });
  });

  it('no cuadra y reporta la diferencia en centavos', () => {
    const resultado = verificarCuadreMonetario({
      subtotalCentavos: 100_000,
      ivaPorTarifa: [{ valorCentavos: 19_000 }],
      impuestoConsumoCentavos: 0,
      propinaCentavos: 0,
      totalCentavos: 100_000,
    });
    expect(resultado).toEqual({ cuadra: false, diferenciaCentavos: 19_000 });
  });

  it('trata subtotal/impuesto/propina null como 0 sin fallar', () => {
    const resultado = verificarCuadreMonetario({
      subtotalCentavos: null,
      ivaPorTarifa: [],
      impuestoConsumoCentavos: null,
      propinaCentavos: null,
      totalCentavos: 0,
    });
    expect(resultado).toEqual({ cuadra: true, diferenciaCentavos: 0 });
  });

  it('total null nunca cuadra — no hay nada contra qué verificar', () => {
    const resultado = verificarCuadreMonetario({
      subtotalCentavos: 100_000,
      ivaPorTarifa: [],
      impuestoConsumoCentavos: null,
      propinaCentavos: null,
      totalCentavos: null,
    });
    expect(resultado.cuadra).toBe(false);
  });
});
