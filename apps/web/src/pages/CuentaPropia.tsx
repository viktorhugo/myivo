import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { authClient } from '../services/auth-client';
import { actualizarIdentificaciones, obtenerIdentificaciones } from '../services/cuenta';
import { obtenerIcono } from '../theme/iconos';
import MarcasEsquina from '../theme/MarcasEsquina';
import type { TemaResuelto } from '../theme/useTheme';

/** Parseo idéntico al que tenía la variable de entorno MIS_IDENTIFICACIONES que esto reemplaza (FR-007). */
function parsearIdentificaciones(texto: string): string[] {
  return texto
    .split(',')
    .map((identificacion) => identificacion.trim())
    .filter((identificacion) => identificacion.length > 0);
}

/** US2 (spec.md) — cambiar contraseña propia + configurar la identificación tributaria propia, sin depender de MIS_IDENTIFICACIONES ni de que alguien más edite un archivo. */
export default function CuentaPropia({ tema, onVolver }: { tema: TemaResuelto; onVolver: () => void }) {
  const [contraseñaActual, setContraseñaActual] = useState('');
  const [contraseñaNueva, setContraseñaNueva] = useState('');
  const [cambiandoContraseña, setCambiandoContraseña] = useState(false);
  const [errorContraseña, setErrorContraseña] = useState<string | null>(null);
  const [contraseñaCambiada, setContraseñaCambiada] = useState(false);

  const [identificacionesTexto, setIdentificacionesTexto] = useState('');
  const [cargandoIdentificaciones, setCargandoIdentificaciones] = useState(true);
  const [guardandoIdentificaciones, setGuardandoIdentificaciones] = useState(false);
  const [errorIdentificaciones, setErrorIdentificaciones] = useState<string | null>(null);
  const [identificacionesGuardadas, setIdentificacionesGuardadas] = useState(false);

  useEffect(() => {
    obtenerIdentificaciones()
      .then((identificaciones) => setIdentificacionesTexto(identificaciones.join(', ')))
      .catch((err) => setErrorIdentificaciones(err instanceof Error ? err.message : 'No se pudieron cargar'))
      .finally(() => setCargandoIdentificaciones(false));
  }, []);

  async function manejarCambioContraseña(event: FormEvent) {
    event.preventDefault();
    setCambiandoContraseña(true);
    setErrorContraseña(null);
    setContraseñaCambiada(false);
    const { error } = await authClient.changePassword({
      currentPassword: contraseñaActual,
      newPassword: contraseñaNueva,
      revokeOtherSessions: true,
    });
    if (error) {
      setErrorContraseña(error.message ?? 'No se pudo cambiar la contraseña');
    } else {
      setContraseñaCambiada(true);
      setContraseñaActual('');
      setContraseñaNueva('');
    }
    setCambiandoContraseña(false);
  }

  async function manejarGuardarIdentificaciones(event: FormEvent) {
    event.preventDefault();
    setGuardandoIdentificaciones(true);
    setErrorIdentificaciones(null);
    setIdentificacionesGuardadas(false);
    try {
      const guardadas = await actualizarIdentificaciones(parsearIdentificaciones(identificacionesTexto));
      setIdentificacionesTexto(guardadas.join(', '));
      setIdentificacionesGuardadas(true);
    } catch (err) {
      setErrorIdentificaciones(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setGuardandoIdentificaciones(false);
    }
  }

  const IconoVolver = obtenerIcono('volver', tema);
  const grosorTrazo = tema === 'nocturne' ? 1.7 : 1.5;

  return (
    <section style={{ padding: '16px 20px', fontFamily: 'var(--font-body)', maxWidth: 480 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <button type="button" onClick={onVolver} aria-label="Volver al listado" style={botonIcono}>
          <IconoVolver size={20} strokeWidth={grosorTrazo} />
        </button>
        <h1 className="heading titulo-pantalla" style={{ margin: 0, fontSize: 26 }}>
          Mi cuenta
        </h1>
      </header>

      <form onSubmit={manejarGuardarIdentificaciones} className="card" style={{ padding: '14px 16px', marginTop: 12 }}>
        <MarcasEsquina />
        <p className="kicker" style={{ margin: 0, color: 'var(--color-accent-fg-tint)' }}>
          Identificación tributaria
        </p>
        <p style={{ margin: '4px 0 10px', fontSize: 12, color: 'var(--color-text-muted)', textWrap: 'pretty' }}>
          Tu cédula o NIT — contra esto se compara cada factura para saber si es elegible para la
          deducción del 1% (FR-015). Puedes poner varias, separadas por coma.
        </p>
        <input
          type="text"
          value={identificacionesTexto}
          onChange={(e) => setIdentificacionesTexto(e.target.value)}
          disabled={cargandoIdentificaciones || guardandoIdentificaciones}
          placeholder="1121880039, 16469166"
          style={{ display: 'block', width: '100%', boxSizing: 'border-box', fontFamily: 'var(--font-body)' }}
        />
        {errorIdentificaciones && (
          <p role="alert" style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--color-estado-fallida-fg)' }}>
            {errorIdentificaciones}
          </p>
        )}
        {identificacionesGuardadas && (
          <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--color-estado-extraida-fg)' }}>
            Guardado — aplica desde tu próxima factura capturada.
          </p>
        )}
        <button
          type="submit"
          className="btn-primary"
          disabled={cargandoIdentificaciones || guardandoIdentificaciones}
          style={{ display: 'block', marginTop: 12, padding: '8px 14px' }}
        >
          {guardandoIdentificaciones ? 'Guardando…' : 'Guardar'}
        </button>
      </form>

      <form onSubmit={manejarCambioContraseña} className="card" style={{ padding: '14px 16px', marginTop: 12 }}>
        <MarcasEsquina />
        <p className="kicker" style={{ margin: 0, color: 'var(--color-accent-fg-tint)' }}>
          Cambiar contraseña
        </p>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)', marginTop: 10 }}>
          Contraseña actual
          <input
            type="password"
            value={contraseñaActual}
            onChange={(e) => setContraseñaActual(e.target.value)}
            autoComplete="current-password"
            required
            style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
          />
        </label>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)', marginTop: 10 }}>
          Contraseña nueva
          <input
            type="password"
            value={contraseñaNueva}
            onChange={(e) => setContraseñaNueva(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
            style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
          />
        </label>
        {errorContraseña && (
          <p role="alert" style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--color-estado-fallida-fg)' }}>
            {errorContraseña}
          </p>
        )}
        {contraseñaCambiada && (
          <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--color-estado-extraida-fg)' }}>
            Contraseña actualizada.
          </p>
        )}
        <button
          type="submit"
          className="btn-primary"
          disabled={cambiandoContraseña}
          style={{ display: 'block', marginTop: 12, padding: '8px 14px' }}
        >
          {cambiandoContraseña ? 'Cambiando…' : 'Cambiar contraseña'}
        </button>
      </form>
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
