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
  type ResultadoValidacionDian,
} from '../services/invoices';
import {
  construirEnlaceDian,
  listarValidacionesDian,
  registrarValidacionDian,
  type ValidacionDianDto,
} from '../services/validacion-dian';
import {
  ETIQUETA_MEDIO_PAGO,
  ETIQUETA_RESULTADO_DIAN,
  ETIQUETA_TIPO_DOCUMENTO,
  OPCIONES_MEDIO_PAGO,
  OPCIONES_RESULTADO_DIAN,
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

function LeyendaConfianza({ tema }: { tema: TemaResuelto }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        fontSize: 10,
        color: tema === 'nocturne' ? 'var(--color-text-muted-2)' : 'rgba(29, 31, 32, 0.5)',
        padding: '10px 2px 0',
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

/** Etiqueta amigable para "Correcciones manuales" — mismos nombres que la rejilla de campos clave/totales, no el nombre interno crudo. */
const ETIQUETA_CAMPO_CORRECCION: Record<string, string> = {
  comercioNombre: 'Comercio',
  comercioNIT: 'NIT',
  fechaHoraCompra: 'Fecha y hora',
  medioPago: 'Medio de pago',
  tipoDocumento: 'Tipo de documento',
  moneda: 'Moneda',
  adquirienteNombre: 'Adquiriente',
  adquirienteIdentificacion: 'Identificación',
  cufe: 'CUFE',
  subtotal: 'Subtotal',
  impuestoConsumo: 'Impuesto al consumo',
  propina: 'Propina',
  total: 'Total',
};

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
        <button
          type="submit"
          className="btn-primary"
          disabled={guardando}
          style={{ fontSize: 11, padding: '3px 8px', fontFamily: 'var(--font-body)', letterSpacing: 'normal' }}
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" onClick={onCancelar} disabled={guardando} className="btn-secondary" style={{ fontSize: 11, padding: '3px 8px' }}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

/** El CUFE completo (~96 caracteres) no cabe en una línea — se ve truncado (el botón de copiar siempre manda el valor completo, así que no se pierde nada). */
function truncarCufe(valor: string): string {
  if (valor.length <= 20) return valor;
  return `${valor.slice(0, 8)}...${valor.slice(-6)}`;
}

/** Botón de copiar junto al valor del CUFE — separado del botón "tocar para editar" para no anidar un botón dentro de otro. */
function BotonCopiarCufe({ tema, valor }: { tema: TemaResuelto; valor: string }) {
  const [copiado, setCopiado] = useState(false);
  const Icono = obtenerIcono(copiado ? 'check-simple' : 'copiar', tema);

  async function copiar() {
    await navigator.clipboard.writeText(valor);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={copiar}
      aria-label={copiado ? 'CUFE copiado' : 'Copiar CUFE'}
      title={copiado ? 'CUFE copiado' : 'Copiar CUFE'}
      style={{
        flex: 'none',
        background: 'transparent',
        border: 'none',
        color: copiado ? 'var(--color-estado-extraida-fg)' : 'var(--color-text-muted)',
        cursor: 'pointer',
        padding: 4,
        marginTop: 1,
      }}
    >
      <Icono size={15} strokeWidth={tema === 'nocturne' ? 1.7 : 1.5} />
    </button>
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
  // El CUFE ocupa las 2 columnas de la rejilla y va en fuente monoespaciada
  // — es un identificador largo tipo hash, no un dato de lectura normal.
  const esCufe = definicion.campoPublico === 'cufe';

  return (
    <div className="celda-campo" style={esCufe ? { gridColumn: '1 / 3' } : undefined}>
      <div className="etiqueta-campo">
        {definicion.etiqueta}
        {definicion.campoConfianza && <PuntoConfianza valor={confianza} />}
        <IconoEditar size={10} />
      </div>
      {editando ? (
        <EditorCampo definicion={definicion} onGuardar={onGuardar} onCancelar={onCancelar} />
      ) : esCufe && definicion.valorEdicion ? (
        // Fila propia (no anidada en el botón) — un botón dentro de otro
        // botón no es HTML válido, así que "copiar" va como hermano de
        // "tocar para editar", no adentro.
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
          <button type="button" onClick={onEditar} className="valor-campo" title={definicion.valorMostrado} style={{ flex: 1 }}>
            <span style={{ wordBreak: 'break-all', fontFamily: 'ui-monospace, Menlo, monospace' }}>
              {truncarCufe(definicion.valorMostrado)}
              {correccion && <span className="badge-corregido">Corregido</span>}
            </span>
            {correccion && (
              <span
                style={{
                  display: 'block',
                  fontSize: 11,
                  color: 'var(--color-text-faint)',
                  textDecoration: 'line-through',
                }}
              >
                original: {correccion.valorExtraidoOriginal}
              </span>
            )}
          </button>
          <BotonCopiarCufe tema={tema} valor={definicion.valorEdicion} />
        </div>
      ) : (
        <button type="button" onClick={onEditar} className="valor-campo" title="Tocar para corregir">
          <span
            style={{
              wordBreak: esCufe ? 'break-all' : 'break-word',
              fontFamily: esCufe ? 'ui-monospace, Menlo, monospace' : undefined,
            }}
          >
            {definicion.valorMostrado}
            {correccion && <span className="badge-corregido">Corregido</span>}
          </span>
          {correccion && (
            <span
              style={{
                display: 'block',
                fontSize: 11,
                color: 'var(--color-text-faint)',
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
 * Menú "···" con las acciones disponibles — reprocesar (solo si el estado lo
 * permite) y eliminar, con confirmación explícita antes de esta última
 * (spec.md US2, Acceptance Scenario 3) — sin esto sería demasiado fácil
 * perder de vista una factura por error. Reprocesar no necesita esa misma
 * confirmación: es una acción reversible, no destructiva.
 */
function MenuAcciones({
  tema,
  onReprocesar,
  reprocesando,
  mostrarReprocesar,
  onEliminar,
  eliminando,
}: {
  tema: TemaResuelto;
  onReprocesar: () => void;
  reprocesando: boolean;
  mostrarReprocesar: boolean;
  onEliminar: () => void;
  eliminando: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const IconoMenu = obtenerIcono('menu', tema);
  const IconoReprocesar = obtenerIcono('reprocesar', tema);
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
        <IconoMenu size={18} />
      </button>
      {abierto && (
        <>
          {/* Cierra al tocar fuera — el menú se ancla al <header> (position:relative), no a este botón. */}
          <div className="menu-contextual-backdrop" onClick={cerrar} />
          <div className="card menu-contextual">
            <MarcasEsquina />
            {!confirmando ? (
              <>
                {mostrarReprocesar && (
                  <button
                    type="button"
                    onClick={() => {
                      cerrar();
                      onReprocesar();
                    }}
                    disabled={reprocesando}
                    className="menu-contextual-item"
                  >
                    <IconoReprocesar size={15} />
                    {reprocesando ? 'Reprocesando…' : 'Reprocesar'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setConfirmando(true)}
                  className="menu-contextual-item peligro"
                >
                  <IconoEliminar size={15} />
                  Eliminar factura
                </button>
              </>
            ) : (
              <div style={{ padding: '12px 14px', fontFamily: 'var(--font-body)' }}>
                <p
                  style={{
                    margin: '0 0 8px',
                    fontSize: 11.5,
                    color: tema === 'nocturne' ? 'rgba(233, 233, 237, 0.65)' : 'var(--color-text-label)',
                    textWrap: 'pretty',
                  }}
                >
                  El registro y la foto original quedan recuperables — solo deja de aparecer en tu listado.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={onEliminar}
                    disabled={eliminando}
                    style={{
                      flex: 1,
                      padding: 8,
                      fontSize: 12,
                      fontFamily: 'var(--font-body)',
                      fontWeight: tema === 'nocturne' ? 500 : 600,
                      background: tema === 'nocturne' ? 'transparent' : 'var(--color-estado-fallida)',
                      color: tema === 'nocturne' ? 'var(--color-estado-fallida-fg)' : 'var(--color-bg)',
                      border: tema === 'nocturne' ? '1px solid var(--color-estado-fallida-fg)' : 'none',
                      borderRadius: tema === 'nocturne' ? 6 : 0,
                      cursor: 'pointer',
                    }}
                  >
                    {eliminando ? 'Eliminando…' : 'Sí, eliminar'}
                  </button>
                  <button
                    type="button"
                    onClick={cerrar}
                    disabled={eliminando}
                    className="btn-secondary"
                    style={{ flex: 1, padding: 8, fontSize: 12, borderRadius: tema === 'nocturne' ? 6 : 0 }}
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

/**
 * Validación asistida contra la DIAN (spec.md US1, specs/003-validacion-dian)
 * — visible solo si la factura tiene CUFE (FR-005). El enlace y el botón de
 * copiar son las dos formas de llegar al CUFE en el portal de la DIAN: si el
 * parámetro de URL no autocompleta el campo (research.md § 1), copiar+pegar
 * sigue funcionando. El registro del resultado es siempre manual — ninguna
 * llamada de este sistema llega jamás a la DIAN (constitution Principio VI).
 */
function SeccionValidacionDian({ tema, facturaId, cufe }: { tema: TemaResuelto; facturaId: string; cufe: string }) {
  const [historial, setHistorial] = useState<ValidacionDianDto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [registrando, setRegistrando] = useState(false);
  const [resultadoElegido, setResultadoElegido] = useState<ResultadoValidacionDian>('valido_vigente');
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    try {
      setHistorial(await listarValidacionesDian(facturaId));
    } catch {
      // No bloquea el resto del Detalle si esto falla — se reintenta al recargar.
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, [facturaId]);

  async function copiarCufe() {
    await navigator.clipboard.writeText(cufe);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  async function registrar() {
    setRegistrando(true);
    setError(null);
    try {
      await registrarValidacionDian(facturaId, resultadoElegido);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la validación');
    } finally {
      setRegistrando(false);
    }
  }

  const ultima = historial[0];

  return (
    <div className="card" style={{ padding: '12px 14px', marginTop: 14 }}>
      <MarcasEsquina />
      <p className="kicker" style={{ margin: 0, color: tema === 'nocturne' ? 'var(--color-accent)' : 'var(--color-accent-fg-tint)' }}>
        Validación DIAN
      </p>
      {ultima && (
        <p style={{ margin: '4px 0 0', fontSize: 12, color: tema === 'nocturne' ? 'rgba(233, 233, 237, 0.6)' : 'rgba(29, 31, 32, 0.6)' }}>
          <strong>{ETIQUETA_RESULTADO_DIAN[ultima.resultado]}</strong> · {formatearFecha(ultima.creadaEn, { conAnio: true })}
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <a
          href={construirEnlaceDian(cufe)}
          target="_blank"
          rel="noreferrer"
          className="btn-primary"
          style={{ flex: 1, padding: 8, fontSize: 12, fontFamily: 'var(--font-body)', letterSpacing: 'normal', textAlign: 'center', textDecoration: 'none' }}
        >
          Consultar en la DIAN
        </a>
        <button type="button" onClick={copiarCufe} className="btn-secondary" style={{ flex: 1, padding: 8, fontSize: 12 }}>
          {copiado ? 'CUFE copiado' : 'Copiar CUFE'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={resultadoElegido}
          onChange={(e) => setResultadoElegido(e.target.value as ResultadoValidacionDian)}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            padding: '5px 6px',
            color: 'var(--color-text)',
            background: 'transparent',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-button)',
          }}
        >
          {OPCIONES_RESULTADO_DIAN.map((opcion) => (
            <option key={opcion} value={opcion}>
              {ETIQUETA_RESULTADO_DIAN[opcion]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={registrar}
          disabled={registrando}
          className="btn-primary"
          style={{ padding: 8, fontSize: 12, fontFamily: 'var(--font-body)', letterSpacing: 'normal' }}
        >
          {registrando ? 'Registrando…' : 'Registrar resultado'}
        </button>
      </div>

      {error && (
        <p role="alert" style={{ fontSize: 11, color: 'var(--color-estado-fallida-fg)', marginTop: 4 }}>
          {error}
        </p>
      )}

      {!cargando && historial.length > 1 && (
        <details style={{ marginTop: 8, fontSize: 12 }}>
          <summary style={{ cursor: 'pointer', color: 'var(--color-text-muted)' }}>
            Ver historial completo ({historial.length})
          </summary>
          <div style={{ marginTop: 6 }}>
            {historial.map((validacion) => (
              <div
                key={validacion.id}
                style={{ padding: '3px 0', borderBottom: '1px solid var(--color-border-strong)' }}
              >
                {ETIQUETA_RESULTADO_DIAN[validacion.resultado]} · {formatearFecha(validacion.creadaEn)}
                {validacion.metodo === 'conciliacion' && ' (conciliación)'}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
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
  const [fotoVisible, setFotoVisible] = useState(true);
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

  const grosorTrazo = tema === 'nocturne' ? 1.7 : 1.5;

  return (
    <section style={{ padding: '8px 20px 30px', fontFamily: 'var(--font-body)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
        <button
          type="button"
          onClick={onVolver}
          aria-label="Volver"
          style={{ background: 'transparent', border: 'none', color: 'var(--color-text)', cursor: 'pointer', padding: 4 }}
        >
          <IconoVolver size={20} strokeWidth={grosorTrazo} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            className="heading titulo-pantalla"
            style={{ margin: 0, fontSize: tema === 'nocturne' ? 19 : 24, lineHeight: 1 }}
          >
            {factura.comercioNombre ?? 'Factura sin comercio'}
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>
            {formatearFecha(factura.fechaHoraCompra, { conAnio: true })}
          </p>
        </div>
        <MenuAcciones
          tema={tema}
          onReprocesar={manejarReprocesar}
          reprocesando={reprocesando}
          mostrarReprocesar={
            factura.estado === 'fallida' ||
            factura.estado === 'necesita_revisión' ||
            factura.estado === 'extraída'
          }
          onEliminar={manejarEliminar}
          eliminando={eliminando}
        />
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
      <button
        type="button"
        onClick={() => setFotoVisible((actual) => !actual)}
        style={{
          display: 'block',
          width: '100%',
          background: 'transparent',
          border: 'none',
          color: 'var(--color-accent-fg-tint)',
          fontFamily: 'var(--font-body)',
          fontWeight: 600,
          fontSize: tema === 'nocturne' ? 13 : 11,
          letterSpacing: tema === 'nocturne' ? 'normal' : '0.04em',
          textAlign: 'center',
          padding: '10px 0 6px',
          cursor: 'pointer',
        }}
      >
        {fotoVisible ? 'Ocultar foto' : 'Mostrar foto'}
      </button>

      {factura.elegibilidadTributaria !== null && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            border: `1px solid ${
              esElegible
                ? tema === 'nocturne'
                  ? 'rgba(124, 199, 154, 0.45)'
                  : 'var(--color-estado-extraida-fg)'
                : 'var(--color-estado-revision-fg)'
            }`,
            background: esElegible && tema === 'nocturne' ? 'rgba(124, 199, 154, 0.05)' : undefined,
            borderRadius: 'var(--radius-card)',
            padding: '10px 12px',
            marginTop: 10,
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
                fontSize: tema === 'nocturne' ? 13.5 : 14,
                fontWeight: tema === 'nocturne' ? 500 : 600,
                color: esElegible
                  ? tema === 'nocturne'
                    ? 'var(--color-estado-extraida-fg)'
                    : '#31543f'
                  : 'var(--color-estado-revision)',
              }}
            >
              {esElegible ? 'Elegible para deducción del 1%' : factura.elegibilidadMotivo}
            </div>
            {esElegible && (
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>
                Factura electrónica · a tu nombre · pago electrónico
              </div>
            )}
          </div>
        </div>
      )}
      {factura.elegibilidadTributaria !== null && (
        <div
          style={{
            fontSize: 10.5,
            color: 'var(--color-text-faint)',
            padding: '6px 2px 0',
            textWrap: 'pretty',
          }}
        >
          El sistema organiza, no emite concepto tributario — revísalo con tu contador antes de usarlo en
          tu declaración de renta.
        </div>
      )}

      {factura.cufe && <SeccionValidacionDian tema={tema} facturaId={factura.id} cufe={factura.cufe} />}

      <LeyendaConfianza tema={tema} />

      <div className="rejilla-campos">{construirCamposClave(factura).map(renderCampo)}</div>

      <p className="kicker" style={{ color: 'var(--color-text-faint)', padding: '12px 0 2px' }}>
        Ítems · {factura.items.length}
      </p>
      {factura.items.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Sin ítems extraídos.</p>
      ) : (
        <div style={{ fontSize: tema === 'nocturne' ? 12.5 : 13 }}>
          {factura.items.map((item, indice) => {
            const esUltimo = indice === factura.items.length - 1;
            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  gap: 8,
                  padding: '5px 0',
                  borderBottom: !esUltimo && tema === 'industry' ? '1px solid var(--color-border-strong)' : undefined,
                  background:
                    !esUltimo && tema === 'nocturne'
                      ? 'linear-gradient(to right, transparent, rgba(233, 233, 237, 0.07) 24px, rgba(233, 233, 237, 0.07) calc(100% - 24px), transparent) no-repeat bottom / 100% 1px'
                      : undefined,
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>{item.descripcion ?? '—'}</span>
                <span style={{ color: tema === 'nocturne' ? 'var(--color-text-muted-2)' : 'rgba(29, 31, 32, 0.5)' }}>
                  {item.cantidad ?? '—'}
                </span>
                <span style={{ width: 70, textAlign: 'right', fontWeight: 500 }}>
                  {formatearCentavos(item.valorTotalCentavos, factura.moneda)}
                </span>
                <PuntoConfianza valor={item.nivelConfianza} />
              </div>
            );
          })}
        </div>
      )}

      <div
        style={{
          borderTop: tema === 'industry' ? '1px solid var(--color-border)' : undefined,
          background:
            tema === 'nocturne'
              ? 'linear-gradient(to right, transparent, rgba(233, 233, 237, 0.16) 24px, rgba(233, 233, 237, 0.16) calc(100% - 24px), transparent) no-repeat top / 100% 1px'
              : undefined,
          marginTop: 6,
          paddingTop: 8,
          fontSize: tema === 'nocturne' ? 12.5 : 13,
        }}
      >
        {construirCamposTotales(factura).map((definicion) => (
          <FilaTotal
            key={definicion.campoPublico}
            tema={tema}
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
            <span style={{ color: tema === 'nocturne' ? 'rgba(233, 233, 237, 0.6)' : 'rgba(29, 31, 32, 0.65)' }}>
              IVA {iva.tarifa}%
            </span>
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
          <span
            className="heading"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              // A diferencia del resto de títulos, esta etiqueta va en
              // versalitas en los DOS temas — única excepción confirmada
              // contra el diseño de referencia (Nocturne normalmente nunca
              // usa mayúsculas forzadas).
              textTransform: 'uppercase',
              fontSize: tema === 'nocturne' ? 13 : 15,
              letterSpacing: tema === 'nocturne' ? '0.04em' : '0.06em',
            }}
          >
            Total
            <PuntoConfianza valor={factura.confianzaCampos.totalCentavos} />
          </span>
          <button
            type="button"
            onClick={() => setCampoEnEdicion('total')}
            className="heading"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text)',
              fontSize: tema === 'nocturne' ? 22 : 24,
              letterSpacing: tema === 'nocturne' ? '-0.01em' : undefined,
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
          <p className="kicker" style={{ color: 'var(--color-text-faint)', padding: '12px 0 4px' }}>
            Correcciones manuales · {factura.correcciones.length}
          </p>
          <div style={{ fontSize: 12, color: tema === 'nocturne' ? 'rgba(233, 233, 237, 0.6)' : 'rgba(29, 31, 32, 0.65)' }}>
            {factura.correcciones.map((correccion) => (
              <div key={correccion.id} style={{ padding: '4px 0' }}>
                {ETIQUETA_CAMPO_CORRECCION[correccion.campo] ?? correccion.campo}:{' '}
                <span style={{ textDecoration: 'line-through', color: 'var(--color-text-faint)' }}>
                  {correccion.valorExtraidoOriginal}
                </span>
                {' → '}
                <strong>{correccion.valorCorregido}</strong>
                {' · '}
                {formatearFecha(correccion.corregidoEn, { conAnio: true })}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function FilaTotal({
  tema,
  definicion,
  confianza,
  editando,
  onEditar,
  onCancelar,
  onGuardar,
}: {
  tema: TemaResuelto;
  definicion: DefinicionCampo;
  confianza: number | undefined;
  editando: boolean;
  onEditar: () => void;
  onCancelar: () => void;
  onGuardar: (campo: string, valor: string) => Promise<void>;
}) {
  const colorEtiqueta = tema === 'nocturne' ? 'rgba(233, 233, 237, 0.6)' : 'rgba(29, 31, 32, 0.65)';

  if (editando) {
    return (
      <div style={{ padding: '3px 0' }}>
        <span style={{ color: colorEtiqueta, fontSize: 12 }}>{definicion.etiqueta}</span>
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
      <span style={{ color: colorEtiqueta, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        {definicion.etiqueta}
        {definicion.campoConfianza && <PuntoConfianza valor={confianza} />}
      </span>
      <span style={{ fontWeight: 500 }}>{definicion.valorMostrado}</span>
    </button>
  );
}
