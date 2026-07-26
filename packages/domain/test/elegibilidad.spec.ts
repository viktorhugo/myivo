import { evaluarElegibilidad2026 } from '../src/tax-rules/elegibilidad';

const MIS_IDENTIFICACIONES = ['123456789', '900123456'];

describe('evaluarElegibilidad2026', () => {
  // spec.md, User Story 3, Acceptance Scenario 1
  it('escenario 1: factura electrónica + a mi nombre + medio de pago electrónico -> elegible', () => {
    const resultado = evaluarElegibilidad2026(
      {
        tipoDocumento: 'factura_electronica',
        adquirienteIdentificacion: '123456789',
        medioPago: 'tarjeta_credito',
      },
      MIS_IDENTIFICACIONES,
    );
    expect(resultado).toEqual({ elegible: true, motivo: null });
  });

  // spec.md, Acceptance Scenario 2
  it('escenario 2: tiquete POS sin CUFE -> no elegible, motivo "es tiquete POS"', () => {
    const resultado = evaluarElegibilidad2026(
      {
        tipoDocumento: 'documento_equivalente_pos',
        adquirienteIdentificacion: null,
        medioPago: null,
      },
      MIS_IDENTIFICACIONES,
    );
    expect(resultado.elegible).toBe(false);
    expect(resultado.motivo).toBe('No elegible: es tiquete POS, no factura electrónica');
  });

  // spec.md, Acceptance Scenario 3
  it('escenario 3: factura electrónica válida pero a nombre de otra persona -> no elegible, "no está a tu nombre"', () => {
    const resultado = evaluarElegibilidad2026(
      {
        tipoDocumento: 'factura_electronica',
        adquirienteIdentificacion: '999999999',
        medioPago: 'tarjeta_debito',
      },
      MIS_IDENTIFICACIONES,
    );
    expect(resultado.elegible).toBe(false);
    expect(resultado.motivo).toBe('No elegible: la factura no está a tu nombre');
  });

  // spec.md, Acceptance Scenario 4
  it('escenario 4: factura electrónica válida pagada en efectivo -> no elegible, "pago en efectivo"', () => {
    const resultado = evaluarElegibilidad2026(
      {
        tipoDocumento: 'factura_electronica',
        adquirienteIdentificacion: '123456789',
        medioPago: 'efectivo',
      },
      MIS_IDENTIFICACIONES,
    );
    expect(resultado.elegible).toBe(false);
    expect(resultado.motivo).toBe('No elegible: pago en efectivo');
  });

  it('tolera el dígito de verificación del NIT al comparar identificación', () => {
    const resultado = evaluarElegibilidad2026(
      {
        tipoDocumento: 'factura_electronica',
        adquirienteIdentificacion: '900123456-1',
        medioPago: 'transferencia_pse',
      },
      MIS_IDENTIFICACIONES,
    );
    expect(resultado.elegible).toBe(true);
  });

  it('tolera puntos y espacios al comparar identificación', () => {
    const resultado = evaluarElegibilidad2026(
      {
        tipoDocumento: 'factura_electronica',
        adquirienteIdentificacion: '123.456.789',
        medioPago: 'billetera_digital',
      },
      MIS_IDENTIFICACIONES,
    );
    expect(resultado.elegible).toBe(true);
  });

  it('adquirienteIdentificacion null -> no elegible, "no está a tu nombre"', () => {
    const resultado = evaluarElegibilidad2026(
      {
        tipoDocumento: 'factura_electronica',
        adquirienteIdentificacion: null,
        medioPago: 'tarjeta_credito',
      },
      MIS_IDENTIFICACIONES,
    );
    expect(resultado.elegible).toBe(false);
    expect(resultado.motivo).toBe('No elegible: la factura no está a tu nombre');
  });

  it('medioPago null (no se pudo leer) -> no elegible, motivo distinto de "pago en efectivo"', () => {
    const resultado = evaluarElegibilidad2026(
      {
        tipoDocumento: 'factura_electronica',
        adquirienteIdentificacion: '123456789',
        medioPago: null,
      },
      MIS_IDENTIFICACIONES,
    );
    expect(resultado.elegible).toBe(false);
    expect(resultado.motivo).toBe('No elegible: no se pudo determinar el medio de pago');
  });

  it('documento_soporte/otro/desconocido -> no elegible con motivo genérico (no dice "tiquete POS")', () => {
    for (const tipoDocumento of ['documento_soporte', 'otro', 'desconocido'] as const) {
      const resultado = evaluarElegibilidad2026(
        { tipoDocumento, adquirienteIdentificacion: '123456789', medioPago: 'tarjeta_credito' },
        MIS_IDENTIFICACIONES,
      );
      expect(resultado.elegible).toBe(false);
      expect(resultado.motivo).toBe('No elegible: no es una factura electrónica de venta');
    }
  });

  it('el orden de motivos respeta la prioridad de FR-015 (tipo de documento primero)', () => {
    // Ni es factura electrónica NI está a mi nombre NI es electrónico —
    // el motivo reportado debe ser el de tipo de documento, no los otros dos.
    const resultado = evaluarElegibilidad2026(
      { tipoDocumento: 'documento_equivalente_pos', adquirienteIdentificacion: '999999999', medioPago: 'efectivo' },
      MIS_IDENTIFICACIONES,
    );
    expect(resultado.motivo).toBe('No elegible: es tiquete POS, no factura electrónica');
  });
});
