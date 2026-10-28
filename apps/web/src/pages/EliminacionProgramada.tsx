import { useState } from 'react';
import { authClient } from '../services/auth-client';
import { cancelarEliminacionCuenta } from '../services/cuenta';
import MarcasEsquina from '../theme/MarcasEsquina';
import type { TemaResuelto } from '../theme/useTheme';

/**
 * specs/008-borrado-cuenta (US2, D3 en research.md): login dentro de la
 * ventana de 30 días ofrece cancelar la eliminación, en vez de la app
 * normal — autoservicio, sin infraestructura de soporte en este proyecto.
 */
export default function EliminacionProgramada({
  tema,
  eliminacionProgramadaPara,
  onCancelada,
}: {
  tema: TemaResuelto;
  eliminacionProgramadaPara: string;
  onCancelada: () => void;
}) {
  const [cancelando, setCancelando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fecha = new Date(eliminacionProgramadaPara).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  async function manejarCancelar() {
    setCancelando(true);
    setError(null);
    try {
      await cancelarEliminacionCuenta();
      onCancelada();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cancelar la eliminación');
      setCancelando(false);
    }
  }

  return (
    <main style={{ maxWidth: 430, margin: '0 auto', padding: '40px 20px', fontFamily: 'var(--font-body)' }}>
      <div className="card" style={{ padding: '18px 16px' }}>
        <MarcasEsquina />
        <p className="kicker" style={{ margin: 0, color: 'var(--color-estado-fallida-fg)' }}>
          Cuenta programada para eliminación
        </p>
        <h1 className="heading" style={{ margin: '8px 0 0', fontSize: tema === 'nocturne' ? 20 : 22 }}>
          Se elimina el {fecha}
        </h1>
        <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.5, textWrap: 'pretty' }}>
          Pediste eliminar tu cuenta. Tus facturas y archivos siguen intactos hasta esa fecha —
          después, la destrucción es permanente e irreversible.
        </p>
        {error && (
          <p role="alert" style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--color-estado-fallida-fg)' }}>
            {error}
          </p>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button
            type="button"
            onClick={manejarCancelar}
            disabled={cancelando}
            className="btn-primary"
            style={{ flex: 1, padding: '9px 0' }}
          >
            {cancelando ? 'Cancelando…' : 'Cancelar eliminación'}
          </button>
          <button
            type="button"
            onClick={() => authClient.signOut()}
            disabled={cancelando}
            className="btn-secondary"
            style={{ flex: 1, padding: '9px 0' }}
          >
            Salir
          </button>
        </div>
      </div>
    </main>
  );
}
