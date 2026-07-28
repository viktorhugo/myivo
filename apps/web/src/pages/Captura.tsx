import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import { obtenerFactura, subirFacturas, urlImagenFactura, type FacturaDto } from '../services/invoices';
import { ETIQUETA_ESTADO } from '../etiquetas';
import { formatearCentavos } from '../format';
import { obtenerIcono, type NombreIcono } from '../theme/iconos';
import MarcasEsquina from '../theme/MarcasEsquina';
import type { TemaResuelto } from '../theme/useTheme';

const ESTADOS_NO_TERMINALES = new Set<FacturaDto['estado']>(['recibida', 'procesando']);

const COLOR_VAR_ESTADO: Record<FacturaDto['estado'], string> = {
  recibida: 'var(--color-estado-recibida)',
  procesando: 'var(--color-estado-procesando)',
  extraída: 'var(--color-estado-extraida-fg)',
  necesita_revisión: 'var(--color-estado-revision-fg)',
  fallida: 'var(--color-estado-fallida-fg)',
  varias_facturas: 'var(--color-estado-varias)',
};

const ICONO_POR_ESTADO: Record<FacturaDto['estado'], NombreIcono> = {
  recibida: 'reloj',
  procesando: 'cargando',
  extraída: 'check',
  necesita_revisión: 'alerta',
  fallida: 'error',
  varias_facturas: 'capas',
};

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

  const IconoVolver = obtenerIcono('volver', tema);
  const IconoCamara = obtenerIcono('camara', tema);
  const IconoGaleria = obtenerIcono('galeria', tema);
  const grosorTrazo = tema === 'nocturne' ? 1.7 : 1.5;

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
        <p className="kicker" style={{ color: 'var(--color-text-muted-2)', padding: '12px 0 4px' }}>
          Lote de hoy — {facturas.length} foto{facturas.length === 1 ? '' : 's'}
        </p>
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
          />
        ))}
      </ul>

      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '14px 2px', textWrap: 'pretty' }}>
        Puedes cerrar esta pantalla — seguimos leyendo tus fotos y te avisamos si algo necesita revisión.
      </p>
    </section>
  );
}

function FilaCaptura({
  factura,
  tema,
  onAbrir,
  onRecapturar,
}: {
  factura: FacturaDto;
  tema: TemaResuelto;
  onAbrir: () => void;
  onRecapturar: () => void;
}) {
  const IconoEstado = obtenerIcono(ICONO_POR_ESTADO[factura.estado], tema);

  const miniatura = (
    <img
      src={urlImagenFactura(factura.id)}
      alt=""
      style={{ width: 48, height: 62, objectFit: 'cover', border: '1px solid var(--color-border)', flex: 'none' }}
    />
  );

  const badgeEstado = (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        fontWeight: 600,
        color: COLOR_VAR_ESTADO[factura.estado],
        flex: 'none',
      }}
    >
      <IconoEstado size={14} />
      {ETIQUETA_ESTADO[factura.estado]}
    </span>
  );

  // Estado terminal sin datos que ver (data-model.md): no tiene sentido abrir
  // un detalle vacío, así que la fila no es un botón — solo "Separar y
  // recapturar" es interactivo, para no anidar controles (FR-028/US3).
  if (factura.estado === 'varias_facturas') {
    return (
      <li className="fila-listado" style={{ ...botonFila, cursor: 'default' }}>
        {miniatura}
        <span style={{ flex: 1, textAlign: 'left' }}>
          <span style={{ display: 'block', fontWeight: 500 }}>
            {factura.comercioNombre ?? factura.id.slice(0, 8)}
          </span>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--color-estado-varias)' }}>
            Vimos varias facturas en esta foto ·{' '}
            <button type="button" onClick={onRecapturar} style={botonEnlaceInline}>
              Separar y recapturar
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
          <span style={{ display: 'block', fontWeight: 500 }}>
            {factura.comercioNombre ?? factura.id.slice(0, 8)}
          </span>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)' }}>
            {factura.totalCentavos !== null
              ? formatearCentavos(factura.totalCentavos, factura.moneda)
              : ETIQUETA_ESTADO[factura.estado]}
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
