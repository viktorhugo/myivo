import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode } from 'react';
import {
  obtenerFactura,
  reprocesarFactura,
  subirFacturas,
  urlImagenFactura,
  type FacturaDto,
} from '../services/invoices';
import { formatearCentavos } from '../format';
import { obtenerIcono, type NombreIcono } from '../theme/iconos';
import MarcasEsquina from '../theme/MarcasEsquina';
import type { TemaResuelto } from '../theme/useTheme';

const ESTADOS_NO_TERMINALES = new Set<FacturaDto['estado']>(['recibida', 'procesando']);

/** Nombre de la clase modificadora de `.badge-estado` en tokens.css. */
const CLASE_BADGE_ESTADO: Record<FacturaDto['estado'], string> = {
  recibida: 'recibida',
  procesando: 'procesando',
  extraída: 'extraida',
  necesita_revisión: 'revision',
  fallida: 'fallida',
  varias_facturas: 'varias',
};

/**
 * Texto del badge — una sola palabra, como el diseño ("REVISIÓN", no
 * "Necesita revisión"). Aparte de `ETIQUETA_ESTADO` (etiquetas.ts), que sí
 * usa la forma larga en Listado/Detalle donde el badge no comparte fila con
 * un subtítulo que ya da el contexto completo.
 */
const ETIQUETA_BADGE_CAPTURA: Record<FacturaDto['estado'], string> = {
  recibida: 'Recibida',
  procesando: 'Procesando',
  extraída: 'Extraída',
  necesita_revisión: 'Revisión',
  fallida: 'Fallida',
  varias_facturas: 'Varias',
};

const ICONO_POR_ESTADO: Record<FacturaDto['estado'], NombreIcono> = {
  recibida: 'reloj',
  procesando: 'cargando',
  extraída: 'check',
  necesita_revisión: 'alerta',
  fallida: 'error',
  varias_facturas: 'capas',
};

/**
 * Color del subtítulo por estado — reusa `--color-estado-*` (la base, no la
 * "-fg"): en Nocturne ambas ya son idénticas, y en Industry la base es
 * justo el tono que el diseño usa para el subtítulo (el badge usa uno más
 * oscuro aparte, vía `.badge-estado`). recibida/procesando/extraída no
 * tienen entrada — usan el gris muted por defecto, igual que el diseño.
 */
const COLOR_SUBTITULO_ESTADO: Partial<Record<FacturaDto['estado'], string>> = {
  necesita_revisión: 'var(--color-estado-revision)',
  fallida: 'var(--color-estado-fallida)',
  varias_facturas: 'var(--color-estado-varias)',
};

function bordeMiniatura(estado: FacturaDto['estado'], tema: TemaResuelto): string {
  if (estado === 'fallida') {
    return tema === 'nocturne' ? '1px solid rgba(224, 138, 128, 0.5)' : '1px solid var(--color-estado-fallida-fg)';
  }
  if (estado === 'varias_facturas') {
    return tema === 'nocturne' ? '1px solid rgba(213, 155, 207, 0.5)' : '1px solid #8a5a86';
  }
  return '1px solid var(--color-border)';
}

export default function Captura({
  tema,
  onSeleccionar,
  onVolver,
}: {
  tema: TemaResuelto;
  onSeleccionar: (facturaId: string) => void;
  onVolver: () => void;
}) {
  const [facturas, setFacturas] = useState<FacturaDto[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const facturasRef = useRef(facturas);
  facturasRef.current = facturas;
  const inputCamaraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const intervalo = setInterval(async () => {
      const pendientes = facturasRef.current.filter((f) => ESTADOS_NO_TERMINALES.has(f.estado));
      if (pendientes.length === 0) return;
      const actualizadas = await Promise.all(pendientes.map((f) => obtenerFactura(f.id).catch(() => null)));
      setFacturas((actuales) =>
        actuales.map((factura) => actualizadas.find((a) => a?.id === factura.id) ?? factura),
      );
    }, 2000);
    return () => clearInterval(intervalo);
  }, []);

  async function subirArchivos(archivos: FileList | null) {
    if (!archivos || archivos.length === 0) return;
    setSubiendo(true);
    setError(null);
    try {
      const nuevas = await subirFacturas(Array.from(archivos));
      setFacturas((actuales) => [...nuevas, ...actuales]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir las facturas');
    } finally {
      setSubiendo(false);
    }
  }

  async function manejarSeleccion(event: ChangeEvent<HTMLInputElement>) {
    await subirArchivos(event.target.files);
    event.target.value = '';
  }

  /** Reintento inline (FR-013) — feedback inmediato en vez de esperar al próximo tick del polling. */
  async function manejarReintentar(facturaId: string) {
    try {
      const actualizada = await reprocesarFactura(facturaId);
      setFacturas((actuales) => actuales.map((f) => (f.id === facturaId ? actualizada : f)));
    } catch {
      // El polling de 2s ya en curso refleja el estado real si esto falla silenciosamente.
    }
  }

  const IconoVolver = obtenerIcono('volver', tema);
  const IconoCamara = obtenerIcono('camara', tema);
  const IconoGaleria = obtenerIcono('galeria', tema);
  const grosorTrazo = tema === 'nocturne' ? 1.7 : 1.5;

  const listas = facturas.filter((f) => f.estado === 'extraída' || f.estado === 'necesita_revisión').length;
  const enProceso = facturas.filter((f) => f.estado === 'procesando').length;

  return (
    <section style={{ padding: '16px 20px', fontFamily: 'var(--font-body)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <button type="button" onClick={onVolver} aria-label="Volver al listado" style={botonIcono}>
          <IconoVolver size={20} strokeWidth={grosorTrazo} />
        </button>
        <h1 className="heading titulo-pantalla" style={{ margin: 0, fontSize: 26 }}>
          Capturar
        </h1>
      </header>

      <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
        <label className="btn-primary" style={{ ...botonGrande, opacity: subiendo ? 0.6 : 1 }}>
          <MarcasEsquina />
          <input
            ref={inputCamaraRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={manejarSeleccion}
            disabled={subiendo}
            style={{ display: 'none' }}
          />
          <IconoCamara size={26} />
          <span className="heading titulo-pantalla" style={{ fontSize: 15, letterSpacing: '0.04em' }}>
            {subiendo ? 'Subiendo…' : 'Tomar foto'}
          </span>
        </label>
        <label
          className="card"
          style={{ ...botonGrande, color: 'var(--color-accent-fg-tint)' }}
        >
          <MarcasEsquina />
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={manejarSeleccion}
            disabled={subiendo}
            style={{ display: 'none' }}
          />
          <IconoGaleria size={26} />
          <span className="heading titulo-pantalla" style={{ fontSize: 15, letterSpacing: '0.04em' }}>
            Subir de galería
          </span>
        </label>
      </div>

      {facturas.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '20px 0 6px' }}>
          <p className="kicker" style={{ margin: 0, color: 'var(--color-text-muted-2)' }}>
            Lote de hoy — {facturas.length} foto{facturas.length === 1 ? '' : 's'}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>
            {listas} lista{listas === 1 ? '' : 's'} · {enProceso} en proceso
          </p>
        </div>
      )}

      {error && (
        <p role="alert" style={{ color: 'var(--color-estado-fallida-fg)' }}>
          {error}
        </p>
      )}

      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {facturas.map((factura) => (
          <FilaCaptura
            key={factura.id}
            factura={factura}
            tema={tema}
            onAbrir={() => onSeleccionar(factura.id)}
            onRecapturar={() => inputCamaraRef.current?.click()}
            onReintentar={() => manejarReintentar(factura.id)}
          />
        ))}
      </ul>

      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '14px 2px', textWrap: 'pretty' }}>
        Puedes cerrar esta pantalla — seguimos leyendo tus fotos y te avisamos si algo necesita revisión.
      </p>
    </section>
  );
}

/** Subtítulo específico por estado (no solo repetir la etiqueta del badge). */
function subtituloFila(factura: FacturaDto): ReactNode {
  switch (factura.estado) {
    case 'recibida':
      return 'En fila para procesar';
    case 'procesando':
      return 'Leyendo los campos…';
    case 'extraída': {
      const campos = Object.keys(factura.confianzaCampos).length;
      return `${formatearCentavos(factura.totalCentavos, factura.moneda)} · ${campos} campo${campos === 1 ? '' : 's'} leído${campos === 1 ? '' : 's'}`;
    }
    case 'necesita_revisión':
      return 'Revisa los campos con baja confianza';
    default:
      return null;
  }
}

function FilaCaptura({
  factura,
  tema,
  onAbrir,
  onRecapturar,
  onReintentar,
}: {
  factura: FacturaDto;
  tema: TemaResuelto;
  onAbrir: () => void;
  onRecapturar: () => void;
  onReintentar: () => void;
}) {
  const IconoEstado = obtenerIcono(ICONO_POR_ESTADO[factura.estado], tema);

  const miniatura = (
    <img
      src={urlImagenFactura(factura.id)}
      alt=""
      style={{
        width: 48,
        height: 62,
        objectFit: 'cover',
        border: bordeMiniatura(factura.estado, tema),
        flex: 'none',
      }}
    />
  );

  const badgeEstado = (
    <span className={`badge-estado ${CLASE_BADGE_ESTADO[factura.estado]}`}>
      <IconoEstado size={14} />
      {ETIQUETA_BADGE_CAPTURA[factura.estado]}
    </span>
  );

  const colorSubtitulo = COLOR_SUBTITULO_ESTADO[factura.estado] ?? 'var(--color-text-muted)';
  // Tamaños exactos del diseño (Industry 14px/12px, Nocturne 13px/11.5px) — sin
  // esto el nombre hereda el tamaño por defecto del navegador (16px), notablemente
  // más grande que cualquiera de los dos.
  const tamañoNombre = tema === 'nocturne' ? 13 : 14;
  const tamañoSubtitulo = tema === 'nocturne' ? 11.5 : 12;

  // varias_facturas/fallida son estados con una acción inline (recapturar /
  // reintentar) — la fila no puede ser un <button> completo en esos casos
  // porque anidaría un control interactivo dentro de otro (accesibilidad
  // inválida); solo el enlace de acción es clicable, igual que en el diseño.
  if (factura.estado === 'varias_facturas' || factura.estado === 'fallida') {
    return (
      <li className="fila-listado" style={{ ...botonFila, cursor: 'default' }}>
        {miniatura}
        <span style={{ flex: 1, textAlign: 'left' }}>
          <span style={{ display: 'block', fontSize: tamañoNombre, fontWeight: 500 }}>
            {factura.comercioNombre ?? factura.id.slice(0, 8)}
          </span>
          <span style={{ display: 'block', fontSize: tamañoSubtitulo, color: colorSubtitulo }}>
            {factura.estado === 'varias_facturas' ? 'Vimos varias facturas en esta foto' : 'No pudimos leer esta factura'}
            {' · '}
            <button
              type="button"
              onClick={factura.estado === 'varias_facturas' ? onRecapturar : onReintentar}
              style={botonEnlaceInline}
            >
              {factura.estado === 'varias_facturas' ? 'Separar y recapturar' : 'Reintentar'}
            </button>
          </span>
        </span>
        {badgeEstado}
      </li>
    );
  }

  return (
    <li className="fila-listado">
      <button type="button" onClick={onAbrir} style={{ ...botonFila }}>
        {miniatura}
        <span style={{ flex: 1, textAlign: 'left' }}>
          <span style={{ display: 'block', fontSize: tamañoNombre, fontWeight: 500 }}>
            {factura.comercioNombre ?? factura.id.slice(0, 8)}
          </span>
          <span style={{ display: 'block', fontSize: tamañoSubtitulo, color: colorSubtitulo }}>
            {subtituloFila(factura)}
          </span>
        </span>
        {badgeEstado}
      </button>
    </li>
  );
}

const botonIcono: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--color-text)',
  cursor: 'pointer',
  padding: 4,
};

const botonGrande: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  padding: '18px 0',
  cursor: 'pointer',
};

const botonEnlaceInline: CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: 0,
  font: 'inherit',
  fontWeight: 600,
  color: 'inherit',
  textDecoration: 'underline',
  textUnderlineOffset: 3,
  cursor: 'pointer',
};

const botonFila: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  width: '100%',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--color-text)',
  fontFamily: 'var(--font-body)',
  padding: 0,
};
