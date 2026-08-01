import { useEffect, useId, useState, type CSSProperties, type FormEvent } from 'react';
import QRCode from 'react-qr-code';
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

  const { data: sesion } = authClient.useSession();
  const dosPasosActivo = sesion?.user.twoFactorEnabled ?? false;

  // Flujo de activación de 2FA: contraseña → QR + códigos de respaldo → código de verificación.
  // Mientras no se confirme el código, el servidor NO marca twoFactorEnabled (better-auth, two-factor/index.mjs).
  const [contraseñaActivar2FA, setContraseñaActivar2FA] = useState('');
  const [confirmandoActivacion2FA, setConfirmandoActivacion2FA] = useState(false);
  const [totpURI, setTotpURI] = useState<string | null>(null);
  const [codigosRespaldo, setCodigosRespaldo] = useState<string[] | null>(null);
  const [codigoVerificacion2FA, setCodigoVerificacion2FA] = useState('');
  const [procesando2FA, setProcesando2FA] = useState(false);
  const [error2FA, setError2FA] = useState<string | null>(null);

  const [mostrandoDesactivar2FA, setMostrandoDesactivar2FA] = useState(false);
  const [contraseñaDesactivar2FA, setContraseñaDesactivar2FA] = useState('');

  const { data: passkeys, isPending: cargandoPasskeys } = authClient.useListPasskeys();
  const [nombrePasskeyNueva, setNombrePasskeyNueva] = useState('');
  const [agregandoPasskey, setAgregandoPasskey] = useState(false);
  const [errorPasskey, setErrorPasskey] = useState<string | null>(null);
  const [eliminandoPasskeyId, setEliminandoPasskeyId] = useState<string | null>(null);

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

  async function manejarActivar2FA(event: FormEvent) {
    event.preventDefault();
    setProcesando2FA(true);
    setError2FA(null);
    const { data, error } = await authClient.twoFactor.enable({ password: contraseñaActivar2FA });
    if (error) {
      setError2FA(error.message ?? 'No se pudo activar la verificación en dos pasos');
    } else {
      setTotpURI(data.totpURI);
      setCodigosRespaldo(data.backupCodes);
      setConfirmandoActivacion2FA(true);
      setContraseñaActivar2FA('');
    }
    setProcesando2FA(false);
  }

  async function manejarConfirmarCodigo2FA(event: FormEvent) {
    event.preventDefault();
    setProcesando2FA(true);
    setError2FA(null);
    const { error } = await authClient.twoFactor.verifyTotp({ code: codigoVerificacion2FA });
    if (error) {
      setError2FA(error.message ?? 'Código inválido');
    } else {
      setConfirmandoActivacion2FA(false);
      setTotpURI(null);
      setCodigosRespaldo(null);
      setCodigoVerificacion2FA('');
    }
    setProcesando2FA(false);
  }

  async function manejarDesactivar2FA(event: FormEvent) {
    event.preventDefault();
    setProcesando2FA(true);
    setError2FA(null);
    const { error } = await authClient.twoFactor.disable({ password: contraseñaDesactivar2FA });
    if (error) {
      setError2FA(error.message ?? 'No se pudo desactivar la verificación en dos pasos');
    } else {
      setMostrandoDesactivar2FA(false);
      setContraseñaDesactivar2FA('');
    }
    setProcesando2FA(false);
  }

  async function manejarAgregarPasskey(event: FormEvent) {
    event.preventDefault();
    setAgregandoPasskey(true);
    setErrorPasskey(null);
    const { error } = await authClient.passkey.addPasskey(nombrePasskeyNueva ? { name: nombrePasskeyNueva } : {});
    if (error) {
      setErrorPasskey(error.message ?? 'No se pudo agregar el passkey');
    } else {
      setNombrePasskeyNueva('');
    }
    setAgregandoPasskey(false);
  }

  async function manejarEliminarPasskey(id: string) {
    setEliminandoPasskeyId(id);
    setErrorPasskey(null);
    const { error } = await authClient.passkey.deletePasskey({ id });
    if (error) {
      setErrorPasskey(error.message ?? 'No se pudo eliminar el passkey');
    }
    setEliminandoPasskeyId(null);
  }

  const IconoVolver = obtenerIcono('volver', tema);
  const IconoEliminar = obtenerIcono('eliminar', tema);
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

      <section className="card" style={{ padding: '14px 16px', marginTop: 12 }}>
        <MarcasEsquina />
        <p className="kicker" style={{ margin: 0, color: 'var(--color-accent-fg-tint)' }}>
          Verificación en dos pasos
        </p>
        <p style={{ margin: '4px 0 10px', fontSize: 12, color: 'var(--color-text-muted)', textWrap: 'pretty' }}>
          Pide un código de una app autenticadora (Google Authenticator, Authy, etc.) además de tu
          contraseña al iniciar sesión.
        </p>

        {confirmandoActivacion2FA && totpURI && codigosRespaldo ? (
          <>
            <p style={{ margin: '0 0 8px', fontSize: 12 }}>
              Escanea este código con tu app autenticadora:
            </p>
            <div style={{ background: '#fff', padding: 12, display: 'inline-block', borderRadius: 4 }}>
              <QRCode value={totpURI} size={160} />
            </div>
            <p style={{ margin: '12px 0 4px', fontSize: 12 }}>
              Guarda estos códigos de respaldo en un lugar seguro — cada uno sirve una sola vez si
              pierdes acceso a tu app autenticadora, y no se vuelven a mostrar:
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 4,
                fontFamily: 'monospace',
                fontSize: 13,
                border: '1px solid var(--color-border)',
                padding: 10,
                borderRadius: 4,
              }}
            >
              {codigosRespaldo.map((codigo) => (
                <span key={codigo}>{codigo}</span>
              ))}
            </div>

            <form onSubmit={manejarConfirmarCodigo2FA} style={{ marginTop: 12 }}>
              <label htmlFor="codigo-verificacion-2fa" style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)' }}>
                Código de 6 dígitos de tu app autenticadora
              </label>
              <input
                id="codigo-verificacion-2fa"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={codigoVerificacion2FA}
                onChange={(e) => setCodigoVerificacion2FA(e.target.value)}
                required
                style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, fontFamily: 'var(--font-body)' }}
              />
              {error2FA && (
                <p role="alert" style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--color-estado-fallida-fg)' }}>
                  {error2FA}
                </p>
              )}
              <button
                type="submit"
                className="btn-primary"
                disabled={procesando2FA}
                style={{ display: 'block', marginTop: 12, padding: '8px 14px' }}
              >
                {procesando2FA ? 'Confirmando…' : 'Confirmar y activar'}
              </button>
            </form>
          </>
        ) : dosPasosActivo ? (
          <>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--color-estado-extraida-fg)' }}>Activa.</p>
            {mostrandoDesactivar2FA ? (
              <form onSubmit={manejarDesactivar2FA} style={{ marginTop: 10 }}>
                <CampoContraseña
                  tema={tema}
                  etiqueta="Confirma tu contraseña para desactivarla"
                  valor={contraseñaDesactivar2FA}
                  onCambiar={setContraseñaDesactivar2FA}
                  autoComplete="current-password"
                />
                {error2FA && (
                  <p role="alert" style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--color-estado-fallida-fg)' }}>
                    {error2FA}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={procesando2FA}
                  style={{ display: 'block', marginTop: 12, padding: '8px 14px' }}
                >
                  {procesando2FA ? 'Desactivando…' : 'Desactivar'}
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMostrandoDesactivar2FA(true);
                  setError2FA(null);
                }}
                style={{ display: 'block', marginTop: 10, padding: '8px 14px' }}
              >
                Desactivar
              </button>
            )}
          </>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>Desactivada.</p>
            <form onSubmit={manejarActivar2FA} style={{ marginTop: 10 }}>
              <CampoContraseña
                tema={tema}
                etiqueta="Tu contraseña (déjalo vacío si tu cuenta es solo de Google/Microsoft/GitHub)"
                valor={contraseñaActivar2FA}
                onCambiar={setContraseñaActivar2FA}
                autoComplete="current-password"
              />
              {error2FA && (
                <p role="alert" style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--color-estado-fallida-fg)' }}>
                  {error2FA}
                </p>
              )}
              <button
                type="submit"
                className="btn-primary"
                disabled={procesando2FA}
                style={{ display: 'block', marginTop: 12, padding: '8px 14px' }}
              >
                {procesando2FA ? 'Activando…' : 'Activar'}
              </button>
            </form>
          </>
        )}
      </section>

      <section className="card" style={{ padding: '14px 16px', marginTop: 12 }}>
        <MarcasEsquina />
        <p className="kicker" style={{ margin: 0, color: 'var(--color-accent-fg-tint)' }}>
          Passkeys
        </p>
        <p style={{ margin: '4px 0 10px', fontSize: 12, color: 'var(--color-text-muted)', textWrap: 'pretty' }}>
          Inicia sesión con tu huella, rostro o PIN del dispositivo, sin escribir la contraseña.
        </p>

        {cargandoPasskeys ? (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>Cargando…</p>
        ) : passkeys && passkeys.length > 0 ? (
          <ul style={{ listStyle: 'none', margin: '0 0 12px', padding: 0 }}>
            {passkeys.map((passkey) => (
              <li
                key={passkey.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <span style={{ fontSize: 13 }}>{passkey.name || 'Passkey sin nombre'}</span>
                <button
                  type="button"
                  onClick={() => manejarEliminarPasskey(passkey.id)}
                  disabled={eliminandoPasskeyId === passkey.id}
                  aria-label={`Eliminar ${passkey.name || 'passkey sin nombre'}`}
                  style={botonIcono}
                >
                  <IconoEliminar size={16} strokeWidth={1.5} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--color-text-muted)' }}>
            Todavía no tienes passkeys registrados.
          </p>
        )}

        <form onSubmit={manejarAgregarPasskey}>
          <label htmlFor="nombre-passkey-nueva" style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)' }}>
            Nombre (opcional, para identificarlo — p. ej. "Mi celular")
          </label>
          <input
            id="nombre-passkey-nueva"
            type="text"
            value={nombrePasskeyNueva}
            onChange={(e) => setNombrePasskeyNueva(e.target.value)}
            style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, fontFamily: 'var(--font-body)' }}
          />
          {errorPasskey && (
            <p role="alert" style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--color-estado-fallida-fg)' }}>
              {errorPasskey}
            </p>
          )}
          <button
            type="submit"
            className="btn-primary"
            disabled={agregandoPasskey}
            style={{ display: 'block', marginTop: 12, padding: '8px 14px' }}
          >
            {agregandoPasskey ? 'Agregando…' : 'Agregar passkey'}
          </button>
        </form>
      </section>
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
