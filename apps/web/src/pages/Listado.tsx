import { useEffect, useRef, useState } from 'react';
import {
  listarFacturas,
  obtenerDuplicadosPendientes,
  resolverDuplicado,
  type FacturaEstado,
  type FacturaDto,
  type FiltrosFacturaParams,
  type MarcaPendienteDto,
  type TipoDocumento,
} from '../services/invoices';
import {
  ETIQUETA_ESTADO,
  ETIQUETA_RESULTADO_DIAN,
  ETIQUETA_TIPO_DOCUMENTO,
  OPCIONES_TIPO_DOCUMENTO,
} from '../etiquetas';
import EstadoVacio from './EstadoVacio';
import {
  formatearCentavos,
  formatearDiferenciaTiempo,
  formatearFecha,
  formatearFechaPartes,
  formatearMesDeGrupo,
} from '../format';
import { obtenerIcono } from '../theme/iconos';
import MarcasEsquina from '../theme/MarcasEsquina';
import type { TemaResuelto } from '../theme/useTheme';

const OPCIONES_ESTADO = Object.keys(ETIQUETA_ESTADO) as (keyof typeof ETIQUETA_ESTADO)[];

export interface FormularioFiltros {
  fechaDesde: string;
  fechaHasta: string;
  comercio: string;
  montoMin: string;
  montoMax: string;
  tipoDocumento: string;
  elegibilidad: string;
  estado: string;
  /** Sin control visible en el formulario — solo se llena vía `filtrosIniciales` (enlace del reporte anual, FR-005). */
  moneda: string;
}

/** Semilla de filtros para llegar ya filtrado (p. ej. desde el reporte anual, specs/004-reporte-anual-renta FR-005). */
export type FiltrosListadoIniciales = Partial<FormularioFiltros>;

const FILTROS_VACIOS: FormularioFiltros = {
  fechaDesde: '',
  fechaHasta: '',
  comercio: '',
  montoMin: '',
  montoMax: '',
  tipoDocumento: '',
  elegibilidad: '',
  estado: '',
  moneda: '',
};

function construirFiltrosParams(formulario: FormularioFiltros): FiltrosFacturaParams {
  const filtros: FiltrosFacturaParams = {};
  if (formulario.fechaDesde) filtros.fechaDesde = formulario.fechaDesde;
  if (formulario.fechaHasta) filtros.fechaHasta = formulario.fechaHasta;
  if (formulario.comercio) filtros.comercio = formulario.comercio;
  if (formulario.montoMin) filtros.montoMinPesos = Number(formulario.montoMin);
  if (formulario.montoMax) filtros.montoMaxPesos = Number(formulario.montoMax);
  if (formulario.tipoDocumento) {
    filtros.tipoDocumento = formulario.tipoDocumento as TipoDocumento;
  }
  if (formulario.elegibilidad) filtros.elegibilidad = formulario.elegibilidad === 'true';
  if (formulario.estado) filtros.estado = formulario.estado as FacturaEstado;
  if (formulario.moneda) filtros.moneda = formulario.moneda;
  return filtros;
}

/** Agrupa por mes calendario de fechaHoraCompra (spec.md § Pantalla 3 — "Lista agrupada por mes"). */
function agruparPorMes(items: FacturaDto[]): { etiqueta: string; facturas: FacturaDto[] }[] {
  const grupos = new Map<string, FacturaDto[]>();
  for (const factura of items) {
    const clave = formatearMesDeGrupo(factura.fechaHoraCompra);
    const grupo = grupos.get(clave) ?? [];
    grupo.push(factura);
    grupos.set(clave, grupo);
  }
  return Array.from(grupos.entries()).map(([etiqueta, facturas]) => ({ etiqueta, facturas }));
}

export default function Listado({
  tema,
  onAbrirFactura,
  onCapturar,
  onConciliarDian,
  onAbrirReporte,
  filtrosIniciales,
}: {
  tema: TemaResuelto;
  onAbrirFactura: (facturaId: string) => void;
  onCapturar: () => void;
  onConciliarDian: () => void;
  onAbrirReporte: () => void;
  /** Llega ya filtrado (p. ej. desde el reporte anual, FR-005) en vez de partir de `FILTROS_VACIOS`. */
  filtrosIniciales?: FiltrosListadoIniciales | undefined;
}) {
  const [formulario, setFormulario] = useState<FormularioFiltros>(() => ({
    ...FILTROS_VACIOS,
    ...filtrosIniciales,
  }));
  const [items, setItems] = useState<FacturaDto[]>([]);
  const [conteo, setConteo] = useState(0);
  const [sumaTotal, setSumaTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [duplicadosPendientes, setDuplicadosPendientes] = useState<MarcaPendienteDto[]>([]);
  // Con filtros semilla (desde el reporte anual) arrancan visibles, para que
  // quede claro por qué el listado ya no muestra todo (FR-005).
  const [filtrosVisibles, setFiltrosVisibles] = useState(filtrosIniciales !== undefined);
  const [busquedaVisible, setBusquedaVisible] = useState(false);

  async function cargarDuplicadosPendientes() {
    try {
      setDuplicadosPendientes(await obtenerDuplicadosPendientes());
    } catch {
      // No bloquea el listado si esto falla (FR-021) — se reintenta en el próximo montaje.
    }
  }

  async function buscar(filtros: FormularioFiltros, signal?: AbortSignal) {
    setCargando(true);
    setError(null);
    try {
      // La tarjeta y la lista comparten la misma consulta: la tarjeta ya no
      // fuerza ningún criterio de elegibilidad propio, solo refleja los
      // filtros activos tal cual (incluida la elegibilidad, si el usuario
      // eligió una) — sin filtro de elegibilidad, suma TODO en COP.
      const resultado = await listarFacturas(construirFiltrosParams(filtros), signal);
      setItems(resultado.items);
      setConteo(resultado.conteo);
      setSumaTotal(resultado.sumaTotal);
    } catch (err) {
      // Una búsqueda cancelada porque el filtro volvió a cambiar no es un
      // error real — la búsqueda más reciente ya está en camino.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las facturas');
    } finally {
      setCargando(false);
    }
  }

  const esPrimeraCarga = useRef(true);

  // Auto-aplica en cada cambio de filtro, sin botón "Aplicar" — con debounce
  // para no disparar una búsqueda por cada tecla, y cancelando la búsqueda
  // anterior si el usuario vuelve a cambiar el filtro antes de que responda
  // (evita que una respuesta vieja y lenta sobrescriba una más reciente).
  useEffect(() => {
    const demoraMs = esPrimeraCarga.current ? 0 : 400;
    esPrimeraCarga.current = false;
    const controlador = new AbortController();
    const idTimeout = setTimeout(() => {
      buscar(formulario, controlador.signal);
    }, demoraMs);
    return () => {
      clearTimeout(idTimeout);
      controlador.abort();
    };
  }, [formulario]);

  useEffect(() => {
    cargarDuplicadosPendientes();
  }, []);

  function limpiarFiltros() {
    setFormulario(FILTROS_VACIOS);
  }

  const IconoBuscar = obtenerIcono('buscar', tema);
  const IconoFiltro = obtenerIcono('filtro', tema);
  const IconoCamara = obtenerIcono('camara', tema);
  const IconoConciliarDian = obtenerIcono('firma', tema);
  const IconoReporte = obtenerIcono('reporte', tema);

  // "Biblioteca vacía" (US4) es distinto de "0 resultados para el filtro
  // actual" (spec.md § Assumptions) — solo la primera muestra la pantalla de
  // bienvenida; la segunda sigue con el mensaje genérico de siempre.
  const filtrosActivos = Object.keys(construirFiltrosParams(formulario)).length > 0;
  const bibliotecaVacia = !cargando && !filtrosActivos && conteo === 0;
  // Título de la tarjeta: sin elegir elegibilidad, suma todo (elegibles + no
  // elegibles) — "Total facturas" en vez de "Compras elegibles", para no
  // prometer un filtro que no está aplicado.
  const tituloTarjeta =
    formulario.elegibilidad === 'true'
      ? 'Compras elegibles'
      : formulario.elegibilidad === 'false'
        ? 'Compras no elegibles'
        : 'Total facturas';

  return (
    <section style={{ padding: '16px 20px', fontFamily: 'var(--font-body)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <h1 className="heading titulo-pantalla" style={{ margin: 0, fontSize: tema === 'nocturne' ? 21 : 26, flex: 1 }}>
          Mis facturas
        </h1>
        {!bibliotecaVacia && (
          <>
            <button
              type="button"
              className={`boton-icono ${busquedaVisible ? 'activo' : ''}`}
              aria-label="Buscar por comercio"
              aria-pressed={busquedaVisible}
              onClick={() => setBusquedaVisible((visible) => !visible)}
            >
              <IconoBuscar size={16} />
            </button>
            <button
              type="button"
              className={`boton-icono ${filtrosVisibles ? 'activo' : ''}`}
              aria-label="Mostrar filtros"
              aria-pressed={filtrosVisibles}
              onClick={() => setFiltrosVisibles((visible) => !visible)}
            >
              <IconoFiltro size={16} />
            </button>
            <button
              type="button"
              className="boton-icono"
              aria-label="Conciliar con la DIAN"
              title="Conciliar con la DIAN"
              onClick={onConciliarDian}
            >
              <IconoConciliarDian size={16} />
            </button>
            <button
              type="button"
              className="boton-icono"
              aria-label="Reporte anual"
              title="Reporte anual"
              onClick={onAbrirReporte}
            >
              <IconoReporte size={16} />
            </button>
          </>
        )}
      </header>

      {!bibliotecaVacia && (
      <form onSubmit={(e) => e.preventDefault()}>
        {busquedaVisible && (
          <input
            type="search"
            autoFocus
            placeholder="Buscar por comercio…"
            value={formulario.comercio}
            onChange={(e) => setFormulario({ ...formulario, comercio: e.target.value })}
            className="campo-texto"
            style={{ marginTop: 10 }}
          />
        )}

        {filtrosVisibles && (
          <div
            style={{ display: 'flex', flexWrap: 'nowrap', gap: 6, alignItems: 'center', overflowX: 'auto', padding: '10px 0 2px' }}
          >
            <label className={`chip ${formulario.fechaDesde ? 'activo' : ''}`}>
              Desde
              <input
                type="date"
                value={formulario.fechaDesde}
                onChange={(e) => setFormulario({ ...formulario, fechaDesde: e.target.value })}
              />
            </label>
            <label className={`chip ${formulario.fechaHasta ? 'activo' : ''}`}>
              Hasta
              <input
                type="date"
                value={formulario.fechaHasta}
                onChange={(e) => setFormulario({ ...formulario, fechaHasta: e.target.value })}
              />
            </label>
            <label className={`chip ${formulario.montoMin ? 'activo' : ''}`}>
              Min.
              <input
                type="number"
                value={formulario.montoMin}
                onChange={(e) => setFormulario({ ...formulario, montoMin: e.target.value })}
              />
            </label>
            <label className={`chip ${formulario.montoMax ? 'activo' : ''}`}>
              Máx.
              <input
                type="number"
                value={formulario.montoMax}
                onChange={(e) => setFormulario({ ...formulario, montoMax: e.target.value })}
              />
            </label>
            <label className={`chip ${formulario.tipoDocumento ? 'activo' : ''}`}>
              <select
                value={formulario.tipoDocumento}
                onChange={(e) => setFormulario({ ...formulario, tipoDocumento: e.target.value })}
              >
                <option value="">Tipo</option>
                {OPCIONES_TIPO_DOCUMENTO.map((opcion) => (
                  <option key={opcion} value={opcion}>
                    {ETIQUETA_TIPO_DOCUMENTO[opcion]}
                  </option>
                ))}
              </select>
            </label>
            <label className={`chip ${formulario.elegibilidad ? 'activo' : ''}`}>
              <select
                value={formulario.elegibilidad}
                onChange={(e) => setFormulario({ ...formulario, elegibilidad: e.target.value })}
              >
                <option value="">Elegibilidad</option>
                <option value="true">Elegibles</option>
                <option value="false">No elegibles</option>
              </select>
            </label>
            <label className={`chip ${formulario.estado ? 'activo' : ''}`}>
              <select
                value={formulario.estado}
                onChange={(e) => setFormulario({ ...formulario, estado: e.target.value })}
              >
                <option value="">Estado</option>
                {OPCIONES_ESTADO.map((opcion) => (
                  <option key={opcion} value={opcion}>
                    {ETIQUETA_ESTADO[opcion]}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="chip-limpiar" onClick={limpiarFiltros}>
              Limpiar
            </button>
          </div>
        )}
      </form>
      )}

      {error && <p role="alert">{error}</p>}

      {cargando && items.length === 0 ? (
        <p>Cargando…</p>
      ) : bibliotecaVacia ? (
        <EstadoVacio tema={tema} onCapturar={onCapturar} />
      ) : (
        <>
          <div className="card" style={{ padding: '14px 16px', margin: '18px 0 6px', opacity: cargando ? 0.6 : 1 }}>
            <MarcasEsquina />
            <p className="kicker" style={{ color: tema === 'nocturne' ? 'var(--color-accent)' : 'var(--color-accent-fg-tint)' }}>
              {tituloTarjeta} · {new Date().getFullYear()}
            </p>
            <p
              className="heading"
              style={
                tema === 'nocturne'
                  ? { margin: '4px 0 0', fontSize: 36, lineHeight: 1.1, letterSpacing: '-0.02em' }
                  : { margin: '4px 0 0', fontSize: 42, lineHeight: 1.05 }
              }
            >
              {formatearCentavos(sumaTotal, 'COP')}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
              {conteo} factura{conteo === 1 ? '' : 's'} en COP · refleja los filtros activos
            </p>
          </div>

          {items.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)' }}>No hay facturas que coincidan con el filtro.</p>
          ) : (
            agruparPorMes(items).map((grupo) => (
              <div key={grupo.etiqueta}>
                <h2 className="kicker" style={{ color: 'var(--color-text-muted-2)', padding: '12px 0 4px' }}>
                  {grupo.etiqueta}
                </h2>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {grupo.facturas.map((factura) => (
                    <FilaFactura
                      key={factura.id}
                      factura={factura}
                      tema={tema}
                      onAbrir={() => onAbrirFactura(factura.id)}
                    />
                  ))}
                </ul>
              </div>
            ))
          )}
        </>
      )}

      {!bibliotecaVacia && (
        <button
          type="button"
          onClick={onCapturar}
          className="btn-primary"
          aria-label="Capturar factura"
          title="Capturar factura"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            borderRadius: 'var(--radius-fab)',
            width: 58,
            height: 58,
            display: 'grid',
            placeItems: 'center',
            background: tema === 'nocturne' ? 'var(--card-bg)' : undefined,
            boxShadow:
              tema === 'nocturne' ? '0 0 28px rgba(145, 132, 217, 0.35)' : '0 3px 10px rgba(43, 43, 45, 0.16)',
          }}
        >
          <MarcasEsquina />
          <IconoCamara size={24} />
        </button>
      )}

      {duplicadosPendientes[0] && (
        <BottomSheetDuplicado
          marca={duplicadosPendientes[0]}
          onResuelto={() => {
            setDuplicadosPendientes((actuales) => actuales.slice(1));
            buscar(formulario);
          }}
        />
      )}
    </section>
  );
}

/**
 * Presenta una marca `pendiente_confirmacion` a la vez (FR-020) — no bloquea
 * el resto del listado ni de un lote en carga (FR-021), solo pregunta.
 */
function BottomSheetDuplicado({
  marca,
  onResuelto,
}: {
  marca: MarcaPendienteDto;
  onResuelto: () => void;
}) {
  const [resolviendo, setResolviendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolver(resolucion: 'duplicado' | 'distinto') {
    setResolviendo(true);
    setError(null);
    try {
      await resolverDuplicado(marca.id, resolucion);
      onResuelto();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo resolver');
      setResolviendo(false);
    }
  }

  const original = marca.facturaOriginal;
  const candidata = marca.facturaCandidata;
  const horaCandidata = formatearFechaPartes(candidata.fechaHoraCompra).hora;
  const diferencia = formatearDiferenciaTiempo(original.fechaHoraCompra, candidata.fechaHoraCompra);

  const subtitulo =
    marca.metodoDeteccion === 'cufe_exacto'
      ? 'Tienen el mismo identificador único de documento electrónico (CUFE) que una factura que ya tienes registrada.'
      : `Estas dos facturas se parecen mucho: mismo comercio y mismo total${diferencia ? `, con ${diferencia}` : ''}.`;

  return (
    <>
      <div className="duplicado-backdrop" />
      <div className="duplicado-sheet" role="dialog" aria-modal="true" aria-labelledby="duplicado-titulo">
        <div className="duplicado-handle" />
        <p id="duplicado-titulo" className="heading titulo-pantalla duplicado-titulo">
          ¿Es la misma compra?
        </p>
        <p className="duplicado-subtitulo">{subtitulo}</p>

        <div className="duplicado-tarjetas">
          <TarjetaComparativa etiqueta="Ya guardada" factura={original} />
          <TarjetaComparativa etiqueta="Recién capturada" factura={candidata} acento horaDestacada={horaCandidata} />
        </div>

        {error && <p role="alert">{error}</p>}

        <button
          type="button"
          className="btn-primary duplicado-boton"
          onClick={() => resolver('duplicado')}
          disabled={resolviendo}
        >
          <MarcasEsquina />
          Sí, es la misma — conservar una
        </button>
        <button
          type="button"
          className="duplicado-boton duplicado-boton-secundario"
          onClick={() => resolver('distinto')}
          disabled={resolviendo}
        >
          No, son compras distintas
        </button>
        <p className="duplicado-nota">Si es la misma, conservamos la copia con más datos.</p>
      </div>
    </>
  );
}

function TarjetaComparativa({
  etiqueta,
  factura,
  acento,
  horaDestacada,
}: {
  etiqueta: string;
  factura: FacturaDto;
  acento?: boolean;
  horaDestacada?: string;
}) {
  const { dia, hora } = formatearFechaPartes(factura.fechaHoraCompra);
  return (
    <div className={`card duplicado-tarjeta${acento ? ' acento' : ''}`}>
      <MarcasEsquina />
      <p className="kicker">{etiqueta}</p>
      <p className="comercio" title={factura.comercioNombre ?? undefined}>
        {factura.comercioNombre ?? '—'}
      </p>
      <p className="fecha">
        {dia}
        {hora && (
          <>
            {' · '}
            {horaDestacada ? <span className="hora-destacada">{horaDestacada}</span> : hora}
          </>
        )}
      </p>
      <p className="total">{formatearCentavos(factura.totalCentavos, factura.moneda)}</p>
    </div>
  );
}

function FilaFactura({
  factura,
  tema,
  onAbrir,
}: {
  factura: FacturaDto;
  tema: TemaResuelto;
  onAbrir: () => void;
}) {
  const esOtraMoneda = factura.moneda !== 'COP';
  const esElegible = factura.elegibilidadTributaria === true;
  const necesitaRevision = factura.estado === 'necesita_revisión';
  const IconoCheck = obtenerIcono('check-simple', tema);
  const tamañoNombre = tema === 'nocturne' ? 14 : 15;
  const pesoMonto = tema === 'nocturne' ? 500 : 600;
  const motivoCorto = factura.elegibilidadMotivo?.replace(/^No elegible:\s*/, '');

  return (
    <li className="fila-listado">
      <button
        type="button"
        onClick={onAbrir}
        style={{
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-text)',
          fontFamily: 'var(--font-body)',
          padding: 0,
          textAlign: 'left',
        }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: 'block',
              fontSize: tamañoNombre,
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={factura.comercioNombre ?? undefined}
          >
            {factura.comercioNombre ?? factura.id}
            {factura.ultimaValidacionDian && (
              <span
                title={`Validación DIAN: ${ETIQUETA_RESULTADO_DIAN[factura.ultimaValidacionDian.resultado]}`}
                style={{
                  display: 'inline-flex',
                  marginLeft: 5,
                  verticalAlign: 'middle',
                  color:
                    factura.ultimaValidacionDian.resultado === 'valido_vigente'
                      ? 'var(--color-estado-extraida-fg)'
                      : 'var(--color-estado-revision-fg)',
                }}
              >
                <IconoCheck size={11} />
              </span>
            )}
          </span>
          {necesitaRevision ? (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                color: 'var(--color-estado-revision)',
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: 'var(--color-estado-revision-fg)',
                  flex: 'none',
                }}
              />
              Necesita revisión · {formatearFecha(factura.fechaHoraCompra)}
            </span>
          ) : (
            <span style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)' }}>
              {formatearFecha(factura.fechaHoraCompra)}
              {esOtraMoneda && (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'var(--color-accent-fg-tint)',
                    background: 'var(--color-accent-bg-tint)',
                    border: tema === 'nocturne' ? '1px solid rgba(145, 132, 217, 0.4)' : 'none',
                    borderRadius: tema === 'nocturne' ? 4 : 0,
                    padding: '1px 6px',
                  }}
                >
                  {factura.moneda}
                </span>
              )}
            </span>
          )}
        </span>
        <span style={{ textAlign: 'right', flex: 'none' }}>
          <span style={{ display: 'block', fontSize: tamañoNombre, fontWeight: pesoMonto }}>
            {formatearCentavos(factura.totalCentavos, factura.moneda)}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 10,
              fontWeight: 500,
              whiteSpace: 'nowrap',
              color: esElegible ? 'var(--color-estado-extraida)' : 'var(--color-text-muted)',
            }}
          >
            {esOtraMoneda ? (
              'Fuera del total en COP'
            ) : factura.elegibilidadTributaria === null ? (
              'Por confirmar'
            ) : esElegible ? (
              <>
                <IconoCheck size={9} />
                Elegible
              </>
            ) : motivoCorto ? (
              `No elegible · ${motivoCorto}`
            ) : (
              'No elegible'
            )}
          </span>
        </span>
      </button>
    </li>
  );
}
