import { useEffect, useId, useState, type CSSProperties, type FormEvent } from 'react';
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

/**
 * Input de contraseña con botón para mostrar/ocultar el valor — patrón de
 * modern-web-guidance § forms (botón `type="button"` con `aria-pressed`,
 * warning para lector de pantalla antes de revelar, nunca reemplaza el
 * `<label>` con `placeholder`).
 */
function CampoContraseña({
  tema,
  etiqueta,
  valor,
  onCambiar,
  autoComplete,
  minLength,
  descripcion,
  ...resto
}: {
  tema: TemaResuelto;
  etiqueta: string;
  valor: string;
  onCambiar: (valor: string) => void;
  autoComplete: 'current-password' | 'new-password';
  minLength?: number;
  descripcion?: string;
} & Pick<React.InputHTMLAttributes<HTMLInputElement>, 'onBlur'>) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const idDescripcion = descripcion ? `${id}-hint` : undefined;
  const idAdvertencia = `${id}-warning`;
  const IconoOjo = obtenerIcono(visible ? 'ocultar-contraseña' : 'mostrar-contraseña', tema);

  return (
    <div style={{ marginTop: 10 }}>
      {/* label con htmlFor explícito, no envolviendo el botón: un botón
          interactivo anidado dentro de un <label> implícito puede competir
          con el paso de foco/clic del label hacia su control asociado. */}
      <label htmlFor={id} style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)' }}>
        {etiqueta}
      </label>
      <span id={idAdvertencia} className="visually-hidden">
        Al mostrarla, tu contraseña queda visible en pantalla.
      </span>
      <span style={{ position: 'relative', display: 'block', marginTop: 4 }}>
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={valor}
          onChange={(e) => onCambiar(e.target.value)}
          autoComplete={autoComplete}
          minLength={minLength}
          required
          aria-describedby={idDescripcion}
          style={{ display: 'block', width: '100%', boxSizing: 'border-box', paddingRight: 34 }}
          {...resto}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-describedby={visible ? undefined : idAdvertencia}
          style={botonOjo}
        >
          <IconoOjo size={16} strokeWidth={1.5} />
        </button>
      </span>
      {descripcion && (
        <span id={idDescripcion} style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted-2)', marginTop: 3 }}>
          {descripcion}
        </span>
      )}
    </div>
  );
}

/** US2 (spec.md) — cambiar contraseña propia + configurar la identificación tributaria propia, sin depender de MIS_IDENTIFICACIONES ni de que alguien más edite un archivo. */
export default function CuentaPropia({ tema, onVolver }: { tema: TemaResuelto; onVolver: () => void }) {
  const [contraseñaActual, setContraseñaActual] = useState('');
  const [contraseñaNueva, setContraseñaNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [confirmacionTocada, setConfirmacionTocada] = useState(false);
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

  // Solo se avisa el desacuerdo después de que el usuario salió del campo de
  // confirmación (modern-web-guidance § validate-input-after-interaction) —
  // avisar mientras todavía está escribiendo la confirmación es prematuro.
  const noCoinciden = confirmacionTocada && confirmacion.length > 0 && contraseñaNueva !== confirmacion;

  async function manejarCambioContraseña(event: FormEvent) {
    event.preventDefault();
    if (contraseñaNueva !== confirmacion) {
      setConfirmacionTocada(true);
      return;
    }
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
      setConfirmacion('');
      setConfirmacionTocada(false);
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

        <CampoContraseña
          tema={tema}
          etiqueta="Contraseña actual"
          valor={contraseñaActual}
          onCambiar={setContraseñaActual}
          autoComplete="current-password"
        />
        <CampoContraseña
          tema={tema}
          etiqueta="Contraseña nueva"
          valor={contraseñaNueva}
          onCambiar={setContraseñaNueva}
          autoComplete="new-password"
          minLength={8}
          descripcion="Ocho caracteres o más."
        />
        <CampoContraseña
          tema={tema}
          etiqueta="Confirmar contraseña nueva"
          valor={confirmacion}
          onCambiar={setConfirmacion}
          autoComplete="new-password"
          minLength={8}
          onBlur={() => setConfirmacionTocada(true)}
        />
        {noCoinciden && (
          <p role="alert" style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--color-estado-fallida-fg)' }}>
            Las contraseñas no coinciden.
          </p>
        )}

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
          style={{ display: 'block', marginTop: 20, padding: '8px 14px' }}
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

const botonOjo: CSSProperties = {
  position: 'absolute',
  right: 4,
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'transparent',
  border: 'none',
  color: 'var(--color-text-muted)',
  cursor: 'pointer',
  padding: 4,
  display: 'flex',
  alignItems: 'center',
};
