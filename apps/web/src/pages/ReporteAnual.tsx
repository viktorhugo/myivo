import { useEffect, useState, type CSSProperties } from 'react';
import {
  consultarReporteAnual,
  exportarReporteAnual,
  obtenerAnioMasAntiguo,
  type FormatoExportacion,
  type ReporteAnualDto,
} from '../services/reportes';
import type { FiltrosListadoIniciales } from './Listado';
import { formatearCentavos, formatearNombreMes } from '../format';
import { obtenerIcono } from '../theme/iconos';
import MarcasEsquina from '../theme/MarcasEsquina';
import type { TemaResuelto } from '../theme/useTheme';

const ANIO_ACTUAL = new Date().getFullYear();

function construirFiltrosDelAnio(anio: number): FiltrosListadoIniciales {
  return {
    fechaDesde: `${anio}-01-01`,
    fechaHasta: `${anio}-12-31`,
    elegibilidad: 'true',
    // COP-only — mismo criterio que el resumen del reporte (FR-009), para que
    // el listado filtrado reconcilie exactamente con el total mostrado aquí
    // (data-model.md § Decisión de diseño, SC-004).
    moneda: 'COP',
  };
}

/**
 * Reporte anual de compras elegibles (spec.md US1, specs/004-reporte-anual-renta)
 * — responde "¿cuánto llevo este año?" sin cálculo manual: total COP, conteo,
 * y desglose de los 12 meses del año elegido.
 */
export default function ReporteAnual({
  tema,
  onVolver,
  onAbrirListado,
}: {
  tema: TemaResuelto;
  onVolver: () => void;
  onAbrirListado: (filtros: FiltrosListadoIniciales) => void;
}) {
  const [anioMin, setAnioMin] = useState<number | null>(null);
  const [anio, setAnio] = useState(ANIO_ACTUAL);
  const [reporte, setReporte] = useState<ReporteAnualDto | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportando, setExportando] = useState<FormatoExportacion | null>(null);
  const [errorExportacion, setErrorExportacion] = useState<string | null>(null);

  async function exportar(formato: FormatoExportacion) {
    setExportando(formato);
    setErrorExportacion(null);
    try {
      await exportarReporteAnual(anio, formato);
    } catch (err) {
      setErrorExportacion(err instanceof Error ? err.message : 'No se pudo exportar el reporte');
    } finally {
      setExportando(null);
    }
  }

  useEffect(() => {
    obtenerAnioMasAntiguo()
      .then(setAnioMin)
      .catch(() => setAnioMin(null));
  }, []);

  useEffect(() => {
    setCargando(true);
    setError(null);
    consultarReporteAnual(anio)
      .then(setReporte)
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar el reporte'))
      .finally(() => setCargando(false));
  }, [anio]);

  const IconoVolver = obtenerIcono('volver', tema);
  const grosorTrazo = tema === 'nocturne' ? 1.7 : 1.5;

  const primerAnio = anioMin ?? ANIO_ACTUAL;
  const anios: number[] = [];
  for (let a = ANIO_ACTUAL; a >= primerAnio; a -= 1) {
    anios.push(a);
  }

  return (
    <section style={{ padding: '16px 20px', fontFamily: 'var(--font-body)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <button type="button" onClick={onVolver} aria-label="Volver al listado" style={botonIcono}>
          <IconoVolver size={20} strokeWidth={grosorTrazo} />
        </button>
        <h1 className="heading titulo-pantalla" style={{ margin: 0, fontSize: 26, flex: 1 }}>
          Reporte anual
        </h1>
        <label className="chip activo">
          Año
          <select value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
            {anios.map((opcion) => (
              <option key={opcion} value={opcion}>
                {opcion}
              </option>
            ))}
          </select>
        </label>
      </header>

      {error && <p role="alert">{error}</p>}

      {cargando || !reporte ? (
        <p>Cargando…</p>
      ) : (
        <>
          <div className="card" style={{ padding: '14px 16px', margin: '6px 0' }}>
            <MarcasEsquina />
            <p className="kicker" style={{ margin: 0, color: 'var(--color-accent-fg-tint)' }}>
              Compras elegibles · {anio}
            </p>
            <p className="heading" style={{ margin: '4px 0 0', fontSize: 42, lineHeight: 1.05 }}>
              {formatearCentavos(reporte.totalCentavos, 'COP')}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
              {reporte.conteo} factura{reporte.conteo === 1 ? '' : 's'} en COP
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                className="btn-primary"
                style={{ padding: '8px 14px' }}
                onClick={() => onAbrirListado(construirFiltrosDelAnio(anio))}
              >
                Ver facturas en el Listado
              </button>
              <button
                type="button"
                className="chip"
                disabled={exportando !== null}
                style={{ opacity: exportando === 'xlsx' ? 0.7 : 1 }}
                onClick={() => exportar('xlsx')}
              >
                {exportando === 'xlsx' ? 'Exportando…' : 'Exportar Excel'}
              </button>
              <button
                type="button"
                className="chip"
                disabled={exportando !== null}
                style={{ opacity: exportando === 'pdf' ? 0.7 : 1 }}
                onClick={() => exportar('pdf')}
              >
                {exportando === 'pdf' ? 'Exportando…' : 'Exportar PDF'}
              </button>
            </div>
            {errorExportacion && (
              <p role="alert" style={{ fontSize: 12, color: 'var(--color-estado-fallida-fg)', marginTop: 8 }}>
                {errorExportacion}
              </p>
            )}
          </div>

          <div className="card" style={{ padding: '14px 16px', margin: '12px 0' }}>
            <MarcasEsquina />
            <p className="kicker" style={{ margin: '0 0 8px', color: 'var(--color-text-muted-2)' }}>
              Desglose mensual
            </p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {reporte.desglosePorMes.map((mesDelAno) => (
                <li
                  key={mesDelAno.mes}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    padding: '6px 0',
                    borderBottom: '1px solid var(--color-border)',
                    fontSize: 13,
                  }}
                >
                  <span style={{ textTransform: 'capitalize' }}>{formatearNombreMes(mesDelAno.mes)}</span>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>
                      {mesDelAno.conteo || ''}
                    </span>
                    <span>{formatearCentavos(mesDelAno.totalCentavos, 'COP')}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p style={{ fontSize: 11, color: 'var(--color-text-muted)', textWrap: 'pretty', marginTop: 4 }}>
            Este reporte organiza información ya calculada por el sistema; no es un concepto tributario.
            Revísalo con tu contador antes de usarlo en tu declaración de renta.
          </p>
        </>
      )}
    </section>
  );
}

const botonIcono: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--color-text)',
  cursor: 'pointer',
  padding: 4,
};
