import { useEffect, useState, type FormEvent } from 'react';
import {
  corregirCampoFactura,
  eliminarFactura,
  obtenerFactura,
  reprocesarFactura,
  urlImagenFactura,
  type ConfianzaCamposDto,
  type CorreccionManualDto,
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
import { obtenerIcono } from '../theme/iconos';
import MarcasEsquina from '../theme/MarcasEsquina';
import type { TemaResuelto } from '../theme/useTheme';

/** Debe coincidir con UMBRAL_CONFIANZA_BAJA en packages/domain/src/tax-rules/cuadre-monetario.ts. */
const UMBRAL_CONFIANZA_BAJA = 0.7;

function colorConfianza(valor: number | undefined): string {
  if (valor === undefined) {
    return 'var(--color-text-muted)';
  }
  if (valor < UMBRAL_CONFIANZA_BAJA) {
    return 'var(--color-estado-fallida-fg)';
  }
  if (valor < 0.9) {
    return 'var(--color-estado-revision-fg)';
  }
  return 'var(--color-estado-extraida-fg)';
}

function PuntoConfianza({ valor }: { valor: number | undefined }) {
  const titulo = valor === undefined ? 'Sin dato de confianza' : `Confianza: ${Math.round(valor * 100)}%`;
  return (
    <span
      title={titulo}
      aria-label={titulo}
      style={{
        display: 'inline-block',
        width: 6,
        height: 6,
        borderRadius: '50%',
        flex: 'none',
        backgroundColor: colorConfianza(valor),
      }}
    />
  );
}

function LeyendaConfianza() {
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        fontSize: 10,
        color: 'var(--color-text-muted)',
        padding: '8px 2px 0',
      }}
    >
      <span>Confianza:</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <PuntoConfianza valor={0.95} /> alta
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <PuntoConfianza valor={0.8} /> media
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <PuntoConfianza valor={0.5} /> baja
      </span>
    </div>
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

/** Campos clave del encabezado — se muestran en la rejilla de 2 columnas del diseño. */
function construirCamposClave(factura: FacturaDetalleDto): DefinicionCampo[] {
  return [
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
      etiqueta: 'NIT',
      valorMostrado: factura.comercioNIT ?? '—',
      valorEdicion: factura.comercioNIT ?? '',
      tipo: 'texto',
    },
    {
      campoPublico: 'fechaHoraCompra',
      campoConfianza: 'fechaHoraCompra',
      etiqueta: 'Fecha y hora',
      valorMostrado: formatearFecha(factura.fechaHoraCompra),
      valorEdicion: factura.fechaHoraCompra ?? '',
      tipo: 'fecha',
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
      campoPublico: 'tipoDocumento',
      etiqueta: 'Tipo de documento',
      valorMostrado: factura.tipoDocumento ? ETIQUETA_TIPO_DOCUMENTO[factura.tipoDocumento] : '—',
      valorEdicion: factura.tipoDocumento ?? '',
      tipo: 'tipoDocumento',
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
      campoPublico: 'adquirienteNombre',
      campoConfianza: 'adquirienteNombre',
      etiqueta: 'Adquiriente',
      valorMostrado: factura.adquirienteNombre ?? '—',
      valorEdicion: factura.adquirienteNombre ?? '',
      tipo: 'texto',
    },
    {
      campoPublico: 'adquirienteIdentificacion',
      campoConfianza: 'adquirienteIdentificacion',
      etiqueta: 'Identificación',
      valorMostrado: factura.adquirienteIdentificacion ?? '—',
      valorEdicion: factura.adquirienteIdentificacion ?? '',
      tipo: 'texto',
    },
    {
      campoPublico: 'cufe',
      etiqueta: factura.cufeOrigen === 'ocr_respaldo' ? 'CUFE (por OCR)' : 'CUFE',
      valorMostrado: factura.cufe ?? '—',
      valorEdicion: factura.cufe ?? '',
      tipo: 'texto',
    },
  ];
}

/** Montos del resumen de totales — mismo mecanismo de corrección, otra presentación. */
function construirCamposTotales(factura: FacturaDetalleDto): DefinicionCampo[] {
  return [
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
  ];
}

/** Última corrección registrada por campo, para el badge "Corregido" (FR-005). */
function ultimaCorreccionPorCampo(correcciones: CorreccionManualDto[]): Map<string, CorreccionManualDto> {
  const mapa = new Map<string, CorreccionManualDto>();
  for (const correccion of correcciones) {
    const previa = mapa.get(correccion.campo);
    if (!previa || correccion.corregidoEn > previa.corregidoEn) {
      mapa.set(correccion.campo, correccion);
    }
  }
  return mapa;
}

function EditorCampo({
  definicion,
  onGuardar,
  onCancelar,
}: {
  definicion: DefinicionCampo;
  onGuardar: (campo: string, valor: string) => Promise<void>;
  onCancelar: () => void;
}) {
  const [valor, setValor] = useState(definicion.valorEdicion);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function manejarSubmit(event: FormEvent) {
    event.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      await onGuardar(definicion.campoPublico, valor);
      onCancelar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la corrección');
      setGuardando(false);
    }
  }

  const estiloControl = {
    width: '100%',
    boxSizing: 'border-box' as const,
    fontFamily: 'var(--font-body)',
    fontSize: 14,
    color: 'var(--color-text)',
    background: 'transparent',
    border: '1px solid var(--color-accent)',
    borderRadius: 'var(--radius-button)',
    padding: '4px 6px',
  };

  return (
    <form onSubmit={manejarSubmit} style={{ marginTop: 2 }}>
      {definicion.tipo === 'medioPago' ? (
        <select value={valor} onChange={(e) => setValor(e.target.value)} style={estiloControl}>
          <option value="">—</option>
          {OPCIONES_MEDIO_PAGO.map((opcion) => (
            <option key={opcion} value={opcion}>
              {ETIQUETA_MEDIO_PAGO[opcion]}
            </option>
          ))}
        </select>
      ) : definicion.tipo === 'tipoDocumento' ? (
        <select value={valor} onChange={(e) => setValor(e.target.value)} style={estiloControl}>
          <option value="">—</option>
          {OPCIONES_TIPO_DOCUMENTO.map((opcion) => (
            <option key={opcion} value={opcion}>
              {ETIQUETA_TIPO_DOCUMENTO[opcion]}
            </option>
          ))}
        </select>
      ) : (
        <input
          autoFocus
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          disabled={guardando}
          style={estiloControl}
        />
      )}
      {error && (
        <p role="alert" style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--color-estado-fallida-fg)' }}>
          {error}
        </p>
      )}
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <button type="submit" className="btn-primary" disabled={guardando} style={{ fontSize: 11, padding: '3px 8px' }}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" onClick={onCancelar} disabled={guardando} style={{ fontSize: 11, padding: '3px 8px' }}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

/** Celda de la rejilla de campos clave — toda la celda es tocable para editar. */
function CeldaCampo({
  definicion,
  confianza,
  correccion,
  tema,
  editando,
  onEditar,
  onCancelar,
  onGuardar,
}: {
  definicion: DefinicionCampo;
  confianza: number | undefined;
  correccion: CorreccionManualDto | undefined;
  tema: TemaResuelto;
  editando: boolean;
  onEditar: () => void;
  onCancelar: () => void;
  onGuardar: (campo: string, valor: string) => Promise<void>;
}) {
  const IconoEditar = obtenerIcono('editar', tema);

  return (
    <div className="celda-campo">
      <div className="etiqueta-campo">
        {definicion.etiqueta}
        {definicion.campoConfianza && <PuntoConfianza valor={confianza} />}
        <IconoEditar size={10} />
      </div>
      {editando ? (
        <EditorCampo definicion={definicion} onGuardar={onGuardar} onCancelar={onCancelar} />
      ) : (
        <button type="button" onClick={onEditar} className="valor-campo" title="Tocar para corregir">
          <span style={{ wordBreak: 'break-word' }}>
            {definicion.valorMostrado}
            {correccion && <span className="badge-corregido">Corregido</span>}
          </span>
          {correccion && (
            <span
              style={{
                display: 'block',
                fontSize: 11,
                color: 'var(--color-text-muted-2)',
                textDecoration: 'line-through',
              }}
            >
              original: {correccion.valorExtraidoOriginal}
            </span>
          )}
        </button>
      )}
    </div>
  );
}

/**
 * Menú "···" con la única acción disponible por ahora (eliminar), con
 * confirmación explícita antes de ejecutar (spec.md US2, Acceptance Scenario
 * 3) — sin esto sería demasiado fácil perder de vista una factura por error.
 */
function MenuAcciones({
  tema,
  onEliminar,
  eliminando,
}: {
  tema: TemaResuelto;
  onEliminar: () => void;
  eliminando: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const IconoMenu = obtenerIcono('menu', tema);
  const IconoEliminar = obtenerIcono('eliminar', tema);

  function cerrar() {
    setAbierto(false);
    setConfirmando(false);
  }

  return (
    <>
      <button
        type="button"
        className="boton-icono"
        aria-label="Más acciones"
        aria-expanded={abierto}
        onClick={() => (abierto ? cerrar() : setAbierto(true))}
        style={{ flex: 'none' }}
      >
        <IconoMenu size={17} />
      </button>
      {abierto && (
        <>
          {/* Cierra al tocar fuera — el menú se ancla al <header> (position:relative), no a este botón. */}
          <div className="menu-contextual-backdrop" onClick={cerrar} />
          <div className="card menu-contextual">
            <MarcasEsquina />
            {!confirmando ? (
              <button
                type="button"
                onClick={() => setConfirmando(true)}
                className="menu-contextual-item peligro"
              >
                <IconoEliminar size={15} />
                Eliminar factura
              </button>
            ) : (
              <div style={{ padding: '10px 14px', fontFamily: 'var(--font-body)' }}>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--color-text-muted)' }}>
                  ¿Eliminar esta factura? El registro y la foto original quedan recuperables — solo
                  deja de aparecer en tu listado.
                </p>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={onEliminar}
                    disabled={eliminando}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      fontSize: 12,
                      fontWeight: 600,
                      background: 'var(--color-estado-fallida-fg)',
                      color: 'var(--color-bg)',
                      border: 'none',
                      borderRadius: 'var(--radius-button)',
                      cursor: 'pointer',
                    }}
                  >
                    {eliminando ? 'Eliminando…' : 'Sí, eliminar'}
                  </button>
                  <button
                    type="button"
                    onClick={cerrar}
                    disabled={eliminando}
                    style={{ flex: 1, padding: '6px 8px', fontSize: 12, cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

export default function Detalle({
  tema,
  facturaId,
  onVolver,
}: {
  tema: TemaResuelto;
  facturaId: string;
  onVolver: () => void;
}) {
  const [factura, setFactura] = useState<FacturaDetalleDto | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reprocesando, setReprocesando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [fotoVisible, setFotoVisible] = useState(false);
  const [campoEnEdicion, setCampoEnEdicion] = useState<string | null>(null);

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

  /** Tras eliminar, la factura deja de ser accesible por GET (FR-009) — se vuelve al listado. */
  async function manejarEliminar() {
    setEliminando(true);
    setError(null);
    try {
      await eliminarFactura(facturaId);
      onVolver();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la factura');
      setEliminando(false);
    }
  }

  const IconoVolver = obtenerIcono('volver', tema);
  const IconoCheck = obtenerIcono('check', tema);
  const IconoAlerta = obtenerIcono('alerta', tema);

  if (cargando) {
    return <p style={{ padding: 20, fontFamily: 'var(--font-body)' }}>Cargando…</p>;
  }

  if (!factura) {
    return (
      <section style={{ padding: 20, fontFamily: 'var(--font-body)' }}>
        <button type="button" onClick={onVolver} className="boton-icono" aria-label="Volver">
          <IconoVolver size={17} />
        </button>
        <p role="alert">{error ?? 'Factura no encontrada'}</p>
      </section>
    );
  }

  const correcciones = ultimaCorreccionPorCampo(factura.correcciones);
  const esElegible = factura.elegibilidadTributaria === true;

  function renderCampo(definicion: DefinicionCampo) {
    return (
      <CeldaCampo
        key={definicion.campoPublico}
        definicion={definicion}
        confianza={
          definicion.campoConfianza && factura ? factura.confianzaCampos[definicion.campoConfianza] : undefined
        }
        correccion={correcciones.get(definicion.campoPublico)}
        tema={tema}
        editando={campoEnEdicion === definicion.campoPublico}
        onEditar={() => setCampoEnEdicion(definicion.campoPublico)}
        onCancelar={() => setCampoEnEdicion(null)}
        onGuardar={guardarCorreccion}
      />
    );
  }

  return (
    <section style={{ padding: '4px 20px 24px', fontFamily: 'var(--font-body)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, position: 'relative' }}>
        <button type="button" onClick={onVolver} className="boton-icono" aria-label="Volver">
          <IconoVolver size={17} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="heading titulo-pantalla" style={{ margin: 0, fontSize: 24, lineHeight: 1 }}>
            {factura.comercioNombre ?? 'Factura sin comercio'}
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>
            {formatearFecha(factura.fechaHoraCompra)} · {ETIQUETA_ESTADO[factura.estado]}
          </p>
        </div>
        <MenuAcciones tema={tema} onEliminar={manejarEliminar} eliminando={eliminando} />
      </header>

      {error && <p role="alert">{error}</p>}

      {fotoVisible && (
        <img
          src={urlImagenFactura(factura.id)}
          alt="Factura original"
          style={{
            width: '100%',
            maxHeight: 220,
            objectFit: 'cover',
            border: 'var(--card-border)',
            borderRadius: 'var(--radius-card)',
          }}
        />
      )}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 2px' }}>
        <button
          type="button"
          onClick={() => setFotoVisible((actual) => !actual)}
          className="heading titulo-pantalla"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--color-accent-fg-tint)',
            fontSize: 11,
            letterSpacing: '0.06em',
            cursor: 'pointer',
          }}
        >
          {fotoVisible ? 'Ocultar foto' : 'Mostrar foto'}
        </button>
      </div>

      {factura.elegibilidadTributaria !== null && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            border: `1px solid ${esElegible ? 'var(--color-estado-extraida-fg)' : 'var(--color-estado-revision-fg)'}`,
            borderRadius: 'var(--radius-card)',
            padding: '10px 12px',
            marginTop: 8,
          }}
        >
          {esElegible ? (
            <IconoCheck size={20} color="var(--color-estado-extraida)" />
          ) : (
            <IconoAlerta size={20} color="var(--color-estado-revision)" />
          )}
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: esElegible ? 'var(--color-estado-extraida)' : 'var(--color-estado-revision)',
              }}
            >
              {esElegible ? 'Elegible para deducción del 1%' : factura.elegibilidadMotivo}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              El sistema organiza, no emite concepto tributario — revísalo con tu contador antes de
              usarlo en tu declaración de renta.
            </div>
          </div>
        </div>
      )}

      {factura.estado === 'fallida' && (
        <p>
          <button
            type="button"
            className="btn-primary"
            onClick={manejarReprocesar}
            disabled={reprocesando}
            style={{ padding: '8px 14px' }}
          >
            {reprocesando ? 'Reprocesando…' : 'Reintentar extracción'}
          </button>
        </p>
      )}

      <LeyendaConfianza />

      <div className="rejilla-campos">{construirCamposClave(factura).map(renderCampo)}</div>

      <p className="kicker" style={{ color: 'var(--color-text-muted-2)', padding: '14px 0 2px' }}>
        Ítems · {factura.items.length}
      </p>
      {factura.items.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Sin ítems extraídos.</p>
      ) : (
        <div style={{ fontSize: 13 }}>
          {factura.items.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                gap: 8,
                padding: '5px 0',
                borderBottom: '1px solid var(--color-border-strong)',
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>{item.descripcion ?? '—'}</span>
              <span style={{ color: 'var(--color-text-muted)' }}>{item.cantidad ?? '—'}</span>
              <span style={{ width: 74, textAlign: 'right', fontWeight: 500 }}>
                {formatearCentavos(item.valorTotalCentavos, factura.moneda)}
              </span>
              <PuntoConfianza valor={item.nivelConfianza} />
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          borderTop: '1px solid var(--color-border)',
          marginTop: 10,
          paddingTop: 8,
          fontSize: 13,
        }}
      >
        {construirCamposTotales(factura).map((definicion) => (
          <FilaTotal
            key={definicion.campoPublico}
            definicion={definicion}
            confianza={definicion.campoConfianza ? factura.confianzaCampos[definicion.campoConfianza] : undefined}
            editando={campoEnEdicion === definicion.campoPublico}
            onEditar={() => setCampoEnEdicion(definicion.campoPublico)}
            onCancelar={() => setCampoEnEdicion(null)}
            onGuardar={guardarCorreccion}
          />
        ))}

        {factura.ivaPorTarifa.map((iva) => (
          <div
            key={iva.tarifa}
            style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}
          >
            <span style={{ color: 'var(--color-text-muted)' }}>IVA {iva.tarifa}%</span>
            <span style={{ fontWeight: 500 }}>{formatearCentavos(iva.valorCentavos, factura.moneda)}</span>
          </div>
        ))}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            padding: '6px 0 10px',
          }}
        >
          <span className="heading titulo-pantalla" style={{ fontSize: 15, letterSpacing: '0.06em' }}>
            Total
          </span>
          <button
            type="button"
            onClick={() => setCampoEnEdicion('total')}
            className="heading"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text)',
              fontSize: 24,
              cursor: 'pointer',
              padding: 0,
            }}
            title="Tocar para corregir"
          >
            {formatearCentavos(factura.totalCentavos, factura.moneda)}
          </button>
        </div>
        {campoEnEdicion === 'total' && (
          <EditorCampo
            definicion={{
              campoPublico: 'total',
              campoConfianza: 'totalCentavos',
              etiqueta: 'Total',
              valorMostrado: formatearCentavos(factura.totalCentavos, factura.moneda),
              valorEdicion: factura.totalCentavos !== null ? String(factura.totalCentavos) : '',
              tipo: 'numero',
            }}
            onGuardar={guardarCorreccion}
            onCancelar={() => setCampoEnEdicion(null)}
          />
        )}
      </div>

      {factura.correcciones.length > 0 && (
        <>
          <p className="kicker" style={{ color: 'var(--color-text-muted-2)', padding: '14px 0 4px' }}>
            Correcciones manuales · {factura.correcciones.length}
          </p>
          <div style={{ fontSize: 12 }}>
            {factura.correcciones.map((correccion) => (
              <div
                key={correccion.id}
                style={{ padding: '4px 0', borderBottom: '1px solid var(--color-border-strong)' }}
              >
                <span style={{ color: 'var(--color-text-muted)' }}>{correccion.campo}: </span>
                <span style={{ textDecoration: 'line-through', color: 'var(--color-text-muted-2)' }}>
                  {correccion.valorExtraidoOriginal}
                </span>
                {' → '}
                <span style={{ fontWeight: 500 }}>{correccion.valorCorregido}</span>
                <span style={{ color: 'var(--color-text-muted-2)' }}> · {formatearFecha(correccion.corregidoEn)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function FilaTotal({
  definicion,
  confianza,
  editando,
  onEditar,
  onCancelar,
  onGuardar,
}: {
  definicion: DefinicionCampo;
  confianza: number | undefined;
  editando: boolean;
  onEditar: () => void;
  onCancelar: () => void;
  onGuardar: (campo: string, valor: string) => Promise<void>;
}) {
  if (editando) {
    return (
      <div style={{ padding: '3px 0' }}>
        <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{definicion.etiqueta}</span>
        <EditorCampo definicion={definicion} onGuardar={onGuardar} onCancelar={onCancelar} />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onEditar}
      title="Tocar para corregir"
      style={{
        display: 'flex',
        width: '100%',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '3px 0',
        background: 'transparent',
        border: 'none',
        color: 'var(--color-text)',
        fontFamily: 'var(--font-body)',
        fontSize: 13,
        cursor: 'pointer',
      }}
    >
      <span style={{ color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        {definicion.etiqueta}
        {definicion.campoConfianza && <PuntoConfianza valor={confianza} />}
      </span>
      <span style={{ fontWeight: 500 }}>{definicion.valorMostrado}</span>
    </button>
  );
}
