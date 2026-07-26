import { useEffect, useState, type FormEvent } from 'react';
import {
  listarFacturas,
  type FacturaDto,
  type FacturaEstado,
  type FiltrosFacturaParams,
  type TipoDocumento,
} from '../services/invoices';
import { ETIQUETA_ESTADO, ETIQUETA_TIPO_DOCUMENTO, OPCIONES_TIPO_DOCUMENTO } from '../etiquetas';
import { formatearCentavos, formatearFecha } from '../format';

const OPCIONES_ESTADO = Object.keys(ETIQUETA_ESTADO) as (keyof typeof ETIQUETA_ESTADO)[];

interface FormularioFiltros {
  fechaDesde: string;
  fechaHasta: string;
  comercio: string;
  montoMin: string;
  montoMax: string;
  tipoDocumento: string;
  elegibilidad: string;
  estado: string;
}

const FILTROS_VACIOS: FormularioFiltros = {
  fechaDesde: '',
  fechaHasta: '',
  comercio: '',
  montoMin: '',
  montoMax: '',
  tipoDocumento: '',
  elegibilidad: '',
  estado: '',
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
  return filtros;
}

export default function Listado({
  onAbrirFactura,
  onCapturar,
}: {
  onAbrirFactura: (facturaId: string) => void;
  onCapturar: () => void;
}) {
  const [formulario, setFormulario] = useState<FormularioFiltros>(FILTROS_VACIOS);
  const [items, setItems] = useState<FacturaDto[]>([]);
  const [conteo, setConteo] = useState(0);
  const [sumaTotal, setSumaTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function buscar(filtros: FormularioFiltros) {
    setCargando(true);
    setError(null);
    try {
      const resultado = await listarFacturas(construirFiltrosParams(filtros));
      setItems(resultado.items);
      setConteo(resultado.conteo);
      setSumaTotal(resultado.sumaTotal);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las facturas');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    buscar(FILTROS_VACIOS);
  }, []);

  function manejarSubmit(event: FormEvent) {
    event.preventDefault();
    buscar(formulario);
  }

  function limpiarFiltros() {
    setFormulario(FILTROS_VACIOS);
    buscar(FILTROS_VACIOS);
  }

  return (
    <section>
      <h1>Mis facturas</h1>

      <form onSubmit={manejarSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        <label>
          Desde
          <br />
          <input
            type="date"
            value={formulario.fechaDesde}
            onChange={(e) => setFormulario({ ...formulario, fechaDesde: e.target.value })}
          />
        </label>
        <label>
          Hasta
          <br />
          <input
            type="date"
            value={formulario.fechaHasta}
            onChange={(e) => setFormulario({ ...formulario, fechaHasta: e.target.value })}
          />
        </label>
        <label>
          Comercio
          <br />
          <input
            type="text"
            value={formulario.comercio}
            onChange={(e) => setFormulario({ ...formulario, comercio: e.target.value })}
          />
        </label>
        <label>
          Monto mín. (COP)
          <br />
          <input
            type="number"
            value={formulario.montoMin}
            onChange={(e) => setFormulario({ ...formulario, montoMin: e.target.value })}
          />
        </label>
        <label>
          Monto máx. (COP)
          <br />
          <input
            type="number"
            value={formulario.montoMax}
            onChange={(e) => setFormulario({ ...formulario, montoMax: e.target.value })}
          />
        </label>
        <label>
          Tipo de documento
          <br />
          <select
            value={formulario.tipoDocumento}
            onChange={(e) => setFormulario({ ...formulario, tipoDocumento: e.target.value })}
          >
            <option value="">Todos</option>
            {OPCIONES_TIPO_DOCUMENTO.map((opcion) => (
              <option key={opcion} value={opcion}>
                {ETIQUETA_TIPO_DOCUMENTO[opcion]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Elegibilidad
          <br />
          <select
            value={formulario.elegibilidad}
            onChange={(e) => setFormulario({ ...formulario, elegibilidad: e.target.value })}
          >
            <option value="">Todas</option>
            <option value="true">Elegibles</option>
            <option value="false">No elegibles</option>
          </select>
        </label>
        <label>
          Estado
          <br />
          <select
            value={formulario.estado}
            onChange={(e) => setFormulario({ ...formulario, estado: e.target.value })}
          >
            <option value="">Todos</option>
            {OPCIONES_ESTADO.map((opcion) => (
              <option key={opcion} value={opcion}>
                {ETIQUETA_ESTADO[opcion]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Filtrar</button>
        <button type="button" onClick={limpiarFiltros}>
          Limpiar
        </button>
      </form>

      {error && <p role="alert">{error}</p>}

      {cargando ? (
        <p>Cargando…</p>
      ) : (
        <>
          <p>
            <strong>{conteo}</strong> factura{conteo === 1 ? '' : 's'} — total{' '}
            <strong>{formatearCentavos(sumaTotal, 'COP')}</strong>
          </p>

          {items.length === 0 ? (
            <p>No hay facturas que coincidan con el filtro.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Comercio</th>
                  <th>Fecha</th>
                  <th>Total</th>
                  <th>Tipo</th>
                  <th>Elegible</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {items.map((factura) => (
                  <FilaFactura key={factura.id} factura={factura} onAbrir={() => onAbrirFactura(factura.id)} />
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      <button
        type="button"
        onClick={onCapturar}
        aria-label="Capturar factura"
        title="Capturar factura"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          borderRadius: '50%',
          width: 56,
          height: 56,
          fontSize: 24,
          lineHeight: 1,
        }}
      >
        +
      </button>
    </section>
  );
}

function FilaFactura({ factura, onAbrir }: { factura: FacturaDto; onAbrir: () => void }) {
  return (
    <tr>
      <td>
        <button type="button" onClick={onAbrir}>
          {factura.comercioNombre ?? factura.id}
        </button>
      </td>
      <td>{formatearFecha(factura.fechaHoraCompra)}</td>
      <td>{formatearCentavos(factura.totalCentavos, factura.moneda)}</td>
      <td>{factura.tipoDocumento ? ETIQUETA_TIPO_DOCUMENTO[factura.tipoDocumento] : '—'}</td>
      <td>{factura.elegibilidadTributaria === null ? '—' : factura.elegibilidadTributaria ? '✓' : '✗'}</td>
      <td>{ETIQUETA_ESTADO[factura.estado]}</td>
    </tr>
  );
}
