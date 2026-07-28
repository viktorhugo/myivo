import { useState, type ChangeEvent, type CSSProperties } from 'react';
import { conciliarDian, type ResumenConciliacionDianDto } from '../services/validacion-dian';
import { obtenerIcono } from '../theme/iconos';
import MarcasEsquina from '../theme/MarcasEsquina';
import type { TemaResuelto } from '../theme/useTheme';

/**
 * Conciliación en lote (spec.md US2, specs/003-validacion-dian) — un único
 * archivo tal cual lo exporta el portal "Facturando Electrónicamente" de la
 * DIAN, nunca un formato inventado por este sistema (research.md § 3).
 */
export default function ConciliacionDian({
  tema,
  onVolver,
}: {
  tema: TemaResuelto;
  onVolver: () => void;
}) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [conciliando, setConciliando] = useState(false);
  const [resumen, setResumen] = useState<ResumenConciliacionDianDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  function manejarSeleccion(event: ChangeEvent<HTMLInputElement>) {
    setArchivo(event.target.files?.[0] ?? null);
    setResumen(null);
    setError(null);
  }

  async function conciliar() {
    if (!archivo) return;
    setConciliando(true);
    setError(null);
    setResumen(null);
    try {
      setResumen(await conciliarDian(archivo));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo conciliar el archivo');
    } finally {
      setConciliando(false);
    }
  }

  const IconoVolver = obtenerIcono('volver', tema);
  const grosorTrazo = tema === 'nocturne' ? 1.7 : 1.5;

  return (
    <section style={{ padding: '16px 20px', fontFamily: 'var(--font-body)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <button type="button" onClick={onVolver} aria-label="Volver al listado" style={botonIcono}>
          <IconoVolver size={20} strokeWidth={grosorTrazo} />
        </button>
        <h1 className="heading titulo-pantalla" style={{ margin: 0, fontSize: 26 }}>
          Conciliar con la DIAN
        </h1>
      </header>

      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textWrap: 'pretty' }}>
        Sube el archivo que descargaste del portal de la DIAN (Facturando Electrónicamente →
        documentos recibidos) para marcar de una sola vez cuáles de tus facturas ya capturadas
        aparecen ahí como válidas.
      </p>

      <div className="card" style={{ padding: '14px 16px', marginTop: 12 }}>
        <MarcasEsquina />
        <label
          style={{
            display: 'block',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--color-text-muted-2)',
            marginBottom: 6,
          }}
        >
          Archivo de la DIAN (.xlsx)
        </label>
        <input
          type="file"
          accept=".xlsx"
          onChange={manejarSeleccion}
          disabled={conciliando}
          style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text)' }}
        />
        <button
          type="button"
          onClick={conciliar}
          disabled={!archivo || conciliando}
          className="btn-primary"
          style={{ display: 'block', marginTop: 12, padding: '8px 14px', opacity: archivo ? 1 : 0.6 }}
        >
          {conciliando ? 'Conciliando…' : 'Conciliar'}
        </button>
      </div>

      {error && (
        <p role="alert" style={{ fontSize: 12, color: 'var(--color-estado-fallida-fg)', marginTop: 10 }}>
          {error}
        </p>
      )}

      {resumen && (
        <div className="card" style={{ padding: '14px 16px', marginTop: 12 }}>
          <MarcasEsquina />
          <p className="kicker" style={{ margin: 0, color: 'var(--color-accent-fg-tint)' }}>
            Resultado
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 14 }}>
            <strong>{resumen.facturasConciliadas}</strong> factura
            {resumen.facturasConciliadas === 1 ? '' : 's'} conciliada
            {resumen.facturasConciliadas === 1 ? '' : 's'}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
            {resumen.cufesSinCoincidencia} CUFE{resumen.cufesSinCoincidencia === 1 ? '' : 's'} del
            archivo sin ninguna factura capturada correspondiente
          </p>
        </div>
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
