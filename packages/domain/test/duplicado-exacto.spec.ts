import { esDuplicadoExactoPorCufe } from '../src/duplicates/duplicado-exacto';

describe('esDuplicadoExactoPorCufe', () => {
  it('mismo CUFE no nulo -> duplicado', () => {
    expect(esDuplicadoExactoPorCufe('abc123', 'abc123')).toBe(true);
  });

  it('CUFE distinto -> no duplicado', () => {
    expect(esDuplicadoExactoPorCufe('abc123', 'xyz789')).toBe(false);
  });

  it('ambos null -> no duplicado (ausencia de CUFE no es una coincidencia)', () => {
    expect(esDuplicadoExactoPorCufe(null, null)).toBe(false);
  });

  it('uno null y el otro con valor -> no duplicado', () => {
    expect(esDuplicadoExactoPorCufe(null, 'abc123')).toBe(false);
    expect(esDuplicadoExactoPorCufe('abc123', null)).toBe(false);
  });
});
