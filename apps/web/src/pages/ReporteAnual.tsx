import { useEffect, useState, type CSSProperties } from 'react';
import {
  consultarReporteAnual,
  exportarReporteAnual,
  obtenerAnioMasAntiguo,
  type DesgloseMesDto,
  type FormatoExportacion,
  type ReporteAnualDto,
} from '../services/reportes';
import type { FiltrosListadoIniciales } from './Listado';
import { formatearCentavos, formatearNombreMes } from '../format';
import { obtenerIcono } from '../theme/iconos';
import MarcasEsquina from '../theme/MarcasEsquina';
import type { TemaResuelto } from '../theme/useTheme';

const ANIO_ACTUAL = new Date().getFullYear();

interface FilaDesglose {
  etiqueta: string;
  conteo: number;
  totalCentavos: number;
  atenuada: boolean;
}

/**
 * Agrupa los meses futuros del año en curso en una sola fila atenuada
 * ("Agosto — diciembre") en vez de listarlos sueltos en $0 — solo aplica al
 * año actual; un año anterior ya tiene sus 12 meses en el pasado.
 */
function construirFilasDesglose(desglosePorMes: DesgloseMesDto[], anio: number): FilaDesglose[] {
  if (anio !== ANIO_ACTUAL) {
    return desglosePorMes.map((mesDelAno) => ({
      etiqueta: formatearNombreMes(mesDelAno.mes),
      conteo: mesDelAno.conteo,
      totalCentavos: mesDelAno.totalCentavos,
      atenuada: false,
    }));
  }
  const mesActual = new Date().getMonth() + 1;
  const filas: FilaDesglose[] = [];
  const futuros = desglosePorMes.filter((m) => m.mes > mesActual);
  for (const mesDelAno of desglosePorMes) {
    if (mesDelAno.mes > mesActual) continue;
    filas.push({
      etiqueta: formatearNombreMes(mesDelAno.mes),
      conteo: mesDelAno.conteo,
      totalCentavos: mesDelAno.totalCentavos,
      atenuada: false,
    });
  }
  if (futuros.length > 0) {
    filas.push({
      etiqueta: `${formatearNombreMes(futuros[0]!.mes)} — diciembre`,
      conteo: futuros.reduce((suma, m) => suma + m.conteo, 0),
      totalCentavos: futuros.reduce((suma, m) => suma + m.totalCentavos, 0),
      atenuada: true,
    });
  }
  return filas;
}

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
    <section style={{ padding: '8px 20px 30px', fontFamily: 'var(--font-body)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" onClick={onVolver} aria-label="Volver al listado" style={botonIcono}>
          <IconoVolver size={20} strokeWidth={grosorTrazo} />
        </button>
        <h1 className="heading titulo-pantalla" style={{ margin: 0, fontSize: tema === 'nocturne' ? 21 : 24, flex: 1 }}>
          Reporte anual
        </h1>
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            fontWeight: tema === 'nocturne' ? 500 : 600,
            padding: '4px 10px',
            borderRadius: tema === 'nocturne' ? 6 : 0,
            background: tema === 'nocturne' ? 'transparent' : 'var(--color-accent)',
            border: tema === 'nocturne' ? '1px solid var(--color-accent)' : 'none',
            color: 'var(--color-accent-fg)',
          }}
        >
          Año
          <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} style={{ background: 'transparent', border: 'none', color: 'inherit', font: 'inherit', marginLeft: 4 }}>
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
          <div className="card" style={{ padding: '14px 16px', marginTop: 16 }}>
            <MarcasEsquina />
            <p className="kicker" style={{ margin: 0, color: tema === 'nocturne' ? 'var(--color-accent)' : 'var(--color-accent-fg-tint)' }}>
              Compras elegibles · {anio}
            </p>
            <p
              className="heading"
              style={
                tema === 'nocturne'
                  ? { margin: '4px 0 0', fontSize: 36, lineHeight: 1.1, letterSpacing: '-0.02em' }
                  : { margin: '4px 0 0', fontSize: 42, lineHeight: 1.05 }
              }
            >
              {formatearCentavos(reporte.totalCentavos, 'COP')}
            </p>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
              {reporte.conteo} factura{reporte.conteo === 1 ? '' : 's'} en COP
            </p>
            <button
              type="button"
              className="btn-primary"
              style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 12, padding: 10, textAlign: 'center' }}
              onClick={() => onAbrirListado(construirFiltrosDelAnio(anio))}
            >
              Ver facturas en el Listado
            </button>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={exportando !== null}
                style={{ flex: 1, padding: 8, fontSize: 12, opacity: exportando === 'xlsx' ? 0.7 : 1 }}
                onClick={() => exportar('xlsx')}
              >
                {exportando === 'xlsx' ? 'Exportando…' : 'Exportar Excel'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={exportando !== null}
                style={{ flex: 1, padding: 8, fontSize: 12, opacity: exportando === 'pdf' ? 0.7 : 1 }}
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

          <div className="card" style={{ padding: '14px 16px', marginTop: 16 }}>
            <MarcasEsquina />
            <p className="kicker" style={{ margin: '0 0 6px', color: tema === 'nocturne' ? 'var(--color-accent)' : 'var(--color-accent-fg-tint)' }}>
              Desglose mensual
            </p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: tema === 'nocturne' ? 13 : 13 }}>
              {construirFilasDesglose(reporte.desglosePorMes, anio).map((fila, indice, filas) => {
                const esUltima = indice === filas.length - 1;
                const colorAtenuado = tema === 'nocturne' ? 'rgba(233, 233, 237, 0.35)' : 'rgba(29, 31, 32, 0.4)';
                return (
                  <li
                    key={fila.etiqueta}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 0',
                      borderBottom: !esUltima && tema === 'industry' ? '1px solid var(--color-border-strong)' : undefined,
                      background:
                        !esUltima && tema === 'nocturne'
                          ? 'linear-gradient(to right, transparent, rgba(233, 233, 237, 0.09) 12px, rgba(233, 233, 237, 0.09) calc(100% - 12px), transparent) no-repeat bottom / 100% 1px'
                          : undefined,
                    }}
                  >
                    <span style={{ textTransform: 'capitalize', color: fila.atenuada ? colorAtenuado : undefined }}>
                      {fila.etiqueta}
                    </span>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>{fila.conteo || ''}</span>
                      <span style={{ fontWeight: 500, color: fila.atenuada ? colorAtenuado : undefined }}>
                        {formatearCentavos(fila.totalCentavos, 'COP')}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <p
            style={{
              fontSize: 10.5,
              color: 'var(--color-text-faint)',
              textAlign: 'center',
              textWrap: 'pretty',
              padding: '14px 4px 0',
            }}
          >
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
