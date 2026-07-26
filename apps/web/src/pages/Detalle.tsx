import { useEffect, useState, type FormEvent } from 'react';
import {
  corregirCampoFactura,
  obtenerFactura,
  reprocesarFactura,
  urlImagenFactura,
  type ConfianzaCamposDto,
  type FacturaDetalleDto,
} from '../services/invoices';
import {
  ETIQUETA_ESTADO,
  ETIQUETA_MEDIO_PAGO,
  ETIQUETA_TIPO_DOCUMENTO,
  OPCIONES_MEDIO_PAGO,
  OPCIONES_TIPO_DOCUMENTO,
} from '../etiquetas';
import { formatearCentavos, formatearFecha } from '../format';

/** Debe coincidir con UMBRAL_CONFIANZA_BAJA en packages/domain/src/tax-rules/cuadre-monetario.ts. */
const UMBRAL_CONFIANZA_BAJA = 0.7;

function colorConfianza(valor: number | undefined): string {
  if (valor === undefined) {
    return '#9aa0a6';
  }
  if (valor < UMBRAL_CONFIANZA_BAJA) {
    return '#d3342d';
  }
  if (valor < 0.9) {
    return '#e0a800';
  }
  return '#2a9d3f';
}

function PuntoConfianza({ valor }: { valor: number | undefined }) {
  const titulo = valor === undefined ? 'Sin dato de confianza' : `Confianza: ${Math.round(valor * 100)}%`;
  return (
    <span
      title={titulo}
      aria-label={titulo}
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: '50%',
        backgroundColor: colorConfianza(valor),
        marginLeft: 8,
      }}
    />
  );
}

interface DefinicionCampo {
  /** Nombre usado en `PATCH /invoices/:id/fields` (puede diferir del interno, p. ej. "total" vs "totalCentavos"). */
  campoPublico: string;
  campoConfianza?: keyof ConfianzaCamposDto;
  etiqueta: string;
  valorMostrado: string;
  valorEdicion: string;
  tipo: 'texto' | 'numero' | 'fecha' | 'medioPago' | 'tipoDocumento';
}

function construirCampos(factura: FacturaDetalleDto): DefinicionCampo[] {
  return [
    {
      campoPublico: 'tipoDocumento',
      etiqueta: 'Tipo de documento',
      valorMostrado: factura.tipoDocumento ? ETIQUETA_TIPO_DOCUMENTO[factura.tipoDocumento] : '—',
      valorEdicion: factura.tipoDocumento ?? '',
      tipo: 'tipoDocumento',
    },
    {
      campoPublico: 'comercioNombre',
      campoConfianza: 'comercioNombre',
      etiqueta: 'Comercio',
      valorMostrado: factura.comercioNombre ?? '—',
      valorEdicion: factura.comercioNombre ?? '',
      tipo: 'texto',
    },
    {
      campoPublico: 'comercioNIT',
      campoConfianza: 'comercioNIT',
      etiqueta: 'NIT del comercio',
      valorMostrado: factura.comercioNIT ?? '—',
      valorEdicion: factura.comercioNIT ?? '',
      tipo: 'texto',
    },
    {
      campoPublico: 'fechaHoraCompra',
      campoConfianza: 'fechaHoraCompra',
      etiqueta: 'Fecha y hora de compra',
      valorMostrado: formatearFecha(factura.fechaHoraCompra),
      valorEdicion: factura.fechaHoraCompra ?? '',
      tipo: 'fecha',
    },
    {
      campoPublico: 'moneda',
      campoConfianza: 'moneda',
      etiqueta: 'Moneda',
      valorMostrado: factura.moneda,
      valorEdicion: factura.moneda,
      tipo: 'texto',
    },
    {
      campoPublico: 'subtotal',
      campoConfianza: 'subtotalCentavos',
      etiqueta: 'Subtotal',
      valorMostrado: formatearCentavos(factura.subtotalCentavos, factura.moneda),
      valorEdicion: factura.subtotalCentavos !== null ? String(factura.subtotalCentavos) : '',
      tipo: 'numero',
    },
    {
      campoPublico: 'impuestoConsumo',
      campoConfianza: 'impuestoConsumoCentavos',
      etiqueta: 'Impuesto al consumo',
      valorMostrado: formatearCentavos(factura.impuestoConsumoCentavos, factura.moneda),
      valorEdicion: factura.impuestoConsumoCentavos !== null ? String(factura.impuestoConsumoCentavos) : '',
      tipo: 'numero',
    },
    {
      campoPublico: 'propina',
      campoConfianza: 'propinaCentavos',
      etiqueta: 'Propina',
      valorMostrado: formatearCentavos(factura.propinaCentavos, factura.moneda),
      valorEdicion: factura.propinaCentavos !== null ? String(factura.propinaCentavos) : '',
      tipo: 'numero',
    },
    {
      campoPublico: 'total',
      campoConfianza: 'totalCentavos',
      etiqueta: 'Total',
      valorMostrado: formatearCentavos(factura.totalCentavos, factura.moneda),
      valorEdicion: factura.totalCentavos !== null ? String(factura.totalCentavos) : '',
      tipo: 'numero',
    },
    {
      campoPublico: 'medioPago',
      campoConfianza: 'medioPago',
      etiqueta: 'Medio de pago',
      valorMostrado: factura.medioPago ? ETIQUETA_MEDIO_PAGO[factura.medioPago] : '—',
      valorEdicion: factura.medioPago ?? '',
      tipo: 'medioPago',
    },
    {
      campoPublico: 'adquirienteNombre',
      campoConfianza: 'adquirienteNombre',
      etiqueta: 'Nombre del adquiriente',
      valorMostrado: factura.adquirienteNombre ?? '—',
      valorEdicion: factura.adquirienteNombre ?? '',
      tipo: 'texto',
    },
    {
      campoPublico: 'adquirienteIdentificacion',
      campoConfianza: 'adquirienteIdentificacion',
      etiqueta: 'Identificación del adquiriente',
      valorMostrado: factura.adquirienteIdentificacion ?? '—',
      valorEdicion: factura.adquirienteIdentificacion ?? '',
      tipo: 'texto',
    },
    {
      campoPublico: 'cufe',
      etiqueta: `CUFE${factura.cufeOrigen === 'ocr_respaldo' ? ' (leído como respaldo, no de QR)' : ''}`,
      valorMostrado: factura.cufe ?? '—',
      valorEdicion: factura.cufe ?? '',
      tipo: 'texto',
    },
  ];
}

function FilaCampoEditable({
  definicion,
  confianza,
  onGuardar,
}: {
  definicion: DefinicionCampo;
  confianza: number | undefined;
  onGuardar: (campo: string, valor: string) => Promise<void>;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(definicion.valorEdicion);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function manejarSubmit(event: FormEvent) {
    event.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      await onGuardar(definicion.campoPublico, valor);
      setEditando(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la corrección');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <tr>
      <th style={{ textAlign: 'left', verticalAlign: 'top' }}>
        {definicion.etiqueta}
        {definicion.campoConfianza && <PuntoConfianza valor={confianza} />}
      </th>
      <td>
        {editando ? (
          <form onSubmit={manejarSubmit} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {definicion.tipo === 'medioPago' ? (
              <select value={valor} onChange={(e) => setValor(e.target.value)}>
                <option value="">—</option>
                {OPCIONES_MEDIO_PAGO.map((opcion) => (
                  <option key={opcion} value={opcion}>
                    {ETIQUETA_MEDIO_PAGO[opcion]}
                  </option>
                ))}
              </select>
            ) : definicion.tipo === 'tipoDocumento' ? (
              <select value={valor} onChange={(e) => setValor(e.target.value)}>
                <option value="">—</option>
                {OPCIONES_TIPO_DOCUMENTO.map((opcion) => (
                  <option key={opcion} value={opcion}>
                    {ETIQUETA_TIPO_DOCUMENTO[opcion]}
                  </option>
                ))}
              </select>
            ) : (
              <input value={valor} onChange={(e) => setValor(e.target.value)} disabled={guardando} />
            )}
            <button type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
            <button type="button" onClick={() => setEditando(false)} disabled={guardando}>
              Cancelar
            </button>
          </form>
        ) : (
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {definicion.valorMostrado}
            <button type="button" onClick={() => setEditando(true)}>
              Corregir
            </button>
          </span>
        )}
        {error && <p role="alert">{error}</p>}
      </td>
    </tr>
  );
}

export default function Detalle({ facturaId, onVolver }: { facturaId: string; onVolver: () => void }) {
  const [factura, setFactura] = useState<FacturaDetalleDto | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reprocesando, setReprocesando] = useState(false);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      setFactura(await obtenerFactura(facturaId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la factura');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, [facturaId]);

  async function guardarCorreccion(campo: string, valorCorregido: string) {
    const actualizada = await corregirCampoFactura(facturaId, campo, valorCorregido);
    setFactura(actualizada);
  }

  async function manejarReprocesar() {
    setReprocesando(true);
    setError(null);
    try {
      await reprocesarFactura(facturaId);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reprocesar la factura');
    } finally {
      setReprocesando(false);
    }
  }

  if (cargando) {
    return <p>Cargando…</p>;
  }

  if (!factura) {
    return (
      <section>
        <button type="button" onClick={onVolver}>
          ← Volver
        </button>
        <p role="alert">{error ?? 'Factura no encontrada'}</p>
      </section>
    );
  }

  return (
    <section>
      <button type="button" onClick={onVolver}>
        ← Volver
      </button>

      <h1>
        {factura.comercioNombre ?? 'Factura sin comercio identificado'} —{' '}
        <strong>{ETIQUETA_ESTADO[factura.estado]}</strong>
      </h1>

      {error && <p role="alert">{error}</p>}

      {factura.elegibilidadTributaria !== null && (
        <div style={{ border: '1px solid #ccc', borderRadius: 4, padding: 12, margin: '12px 0' }}>
          <p style={{ margin: 0 }}>
            <strong>
              {factura.elegibilidadTributaria
                ? 'Elegible para deducción del 1%'
                : factura.elegibilidadMotivo}
            </strong>
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '0.85em', color: '#666' }}>
            El sistema organiza, no emite concepto tributario — revisa esta clasificación con tu
            contador antes de usarla en tu declaración de renta.
          </p>
        </div>
      )}

      {factura.estado === 'fallida' && (
        <p>
          <button type="button" onClick={manejarReprocesar} disabled={reprocesando}>
            {reprocesando ? 'Reprocesando…' : 'Reintentar extracción'}
          </button>
        </p>
      )}

      <details>
        <summary>Ver foto original</summary>
        <img
          src={urlImagenFactura(factura.id)}
          alt="Factura original"
          style={{ maxWidth: '100%', marginTop: 8 }}
        />
      </details>

      <h2>Campos extraídos</h2>
      <table>
        <tbody>
          {construirCampos(factura).map((definicion) => (
            <FilaCampoEditable
              key={definicion.campoPublico}
              definicion={definicion}
              confianza={
                definicion.campoConfianza ? factura.confianzaCampos[definicion.campoConfianza] : undefined
              }
              onGuardar={guardarCorreccion}
            />
          ))}
        </tbody>
      </table>

      <h2>Ítems</h2>
      {factura.items.length === 0 ? (
        <p>Sin ítems extraídos.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Descripción</th>
              <th>Cantidad</th>
              <th>Valor unitario</th>
              <th>Valor total</th>
              <th>Confianza</th>
            </tr>
          </thead>
          <tbody>
            {factura.items.map((item) => (
              <tr key={item.id}>
                <td>{item.descripcion ?? '—'}</td>
                <td>{item.cantidad ?? '—'}</td>
                <td>{formatearCentavos(item.valorUnitarioCentavos, factura.moneda)}</td>
                <td>{formatearCentavos(item.valorTotalCentavos, factura.moneda)}</td>
                <td>
                  <PuntoConfianza valor={item.nivelConfianza} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {factura.correcciones.length > 0 && (
        <>
          <h2>Correcciones manuales</h2>
          <table>
            <thead>
              <tr>
                <th>Campo</th>
                <th>Valor extraído</th>
                <th>Valor corregido</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {factura.correcciones.map((correccion) => (
                <tr key={correccion.id}>
                  <td>{correccion.campo}</td>
                  <td>{correccion.valorExtraidoOriginal}</td>
                  <td>{correccion.valorCorregido}</td>
                  <td>{formatearFecha(correccion.corregidoEn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
