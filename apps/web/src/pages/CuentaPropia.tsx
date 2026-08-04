import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import QRCode from 'react-qr-code';
import { authClient } from '../services/auth-client';
import { actualizarIdentificaciones, obtenerIdentificaciones } from '../services/cuenta';
import CampoContraseña from '../theme/CampoContraseña';
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

  const colorKicker = tema === 'nocturne' ? 'var(--color-accent)' : 'var(--color-accent-fg-tint)';
  const colorDescripcion = tema === 'nocturne' ? 'rgba(233, 233, 237, 0.6)' : 'rgba(29, 31, 32, 0.65)';

  return (
    <section style={{ padding: '8px 20px 40px', fontFamily: 'var(--font-body)', maxWidth: 480 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" onClick={onVolver} aria-label="Volver al listado" style={botonIcono}>
          <IconoVolver size={20} strokeWidth={grosorTrazo} />
        </button>
        <h1 className="heading titulo-pantalla" style={{ margin: 0, fontSize: tema === 'nocturne' ? 21 : 24 }}>
          Mi cuenta
        </h1>
      </header>

      <form onSubmit={manejarGuardarIdentificaciones} className="card" style={{ padding: '14px 16px', marginTop: 18 }}>
        <MarcasEsquina />
        <p className="kicker" style={{ margin: 0, color: colorKicker }}>
          Identificación tributaria
        </p>
        <p style={{ margin: '6px 0 0', fontSize: 12.5, color: colorDescripcion, textWrap: 'pretty' }}>
          Usamos esto para confirmar que las facturas están emitidas a tu nombre.
        </p>
        <input
          type="text"
          value={identificacionesTexto}
          onChange={(e) => setIdentificacionesTexto(e.target.value)}
          disabled={cargandoIdentificaciones || guardandoIdentificaciones}
          placeholder="1121880039, 16469166"
          className="campo-texto"
          style={{ marginTop: 8 }}
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
          style={{ display: 'block', marginTop: 10, padding: '9px 18px' }}
        >
          {guardandoIdentificaciones ? 'Guardando…' : 'Guardar'}
        </button>
      </form>

      <form onSubmit={manejarCambioContraseña} className="card" style={{ padding: '14px 16px', marginTop: 16 }}>
        <MarcasEsquina />
        <p className="kicker" style={{ margin: 0, color: colorKicker }}>
          Cambiar contraseña
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
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
        </div>
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
          style={{ display: 'block', marginTop: 10, padding: '9px 18px' }}
        >
          {cambiandoContraseña ? 'Cambiando…' : 'Cambiar contraseña'}
        </button>
      </form>

      <section className="card" style={{ padding: '14px 16px', marginTop: 16 }}>
        <MarcasEsquina />
        <p className="kicker" style={{ margin: 0, color: colorKicker }}>
          Verificación en dos pasos
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
            <p style={{ margin: '6px 0 0', fontSize: 13 }}>Activa.</p>
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
                  className="btn-secondary"
                  style={{ display: 'block', marginTop: 10, padding: '9px 18px' }}
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
                className="btn-secondary"
                style={{ display: 'block', marginTop: 10, padding: '9px 18px' }}
              >
                Desactivar
              </button>
            )}
          </>
        ) : (
          <>
            <p style={{ margin: '6px 0 0', fontSize: 13 }}>Desactivada.</p>
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
                disabled={procesando2FA}
                className="btn-secondary"
                style={{ display: 'block', marginTop: 10, padding: '9px 18px' }}
              >
                {procesando2FA ? 'Activando…' : 'Activar'}
              </button>
            </form>
          </>
        )}
      </section>

      <section className="card" style={{ padding: '14px 16px', marginTop: 16 }}>
        <MarcasEsquina />
        <p className="kicker" style={{ margin: 0, color: colorKicker }}>
          Passkeys
        </p>
        <p style={{ margin: '6px 0 0', fontSize: 12.5, color: colorDescripcion, textWrap: 'pretty' }}>
          Ingresa sin contraseña usando tu huella, rostro o llave de seguridad.
        </p>

        {cargandoPasskeys ? (
          <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>Cargando…</p>
        ) : passkeys && passkeys.length > 0 ? (
          <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
            {passkeys.map((passkey) => (
              <li
                key={passkey.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderTop: tema === 'industry' ? '1px solid rgba(29, 31, 32, 0.1)' : undefined,
                  background:
                    tema === 'nocturne'
                      ? 'linear-gradient(to right, transparent, rgba(233, 233, 237, 0.09) 12px, rgba(233, 233, 237, 0.09) calc(100% - 12px), transparent) no-repeat top / 100% 1px'
                      : undefined,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 500 }}>{passkey.name || 'Passkey sin nombre'}</span>
                <button
                  type="button"
                  onClick={() => manejarEliminarPasskey(passkey.id)}
                  disabled={eliminandoPasskeyId === passkey.id}
                  aria-label={`Eliminar ${passkey.name || 'passkey sin nombre'}`}
                  style={{ ...botonIcono, color: 'var(--color-estado-fallida-fg)' }}
                >
                  <IconoEliminar size={15} strokeWidth={grosorTrazo} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
            Todavía no tienes passkeys registrados.
          </p>
        )}

        <form onSubmit={manejarAgregarPasskey} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            aria-label="Nombre del passkey (opcional)"
            type="text"
            value={nombrePasskeyNueva}
            onChange={(e) => setNombrePasskeyNueva(e.target.value)}
            placeholder="Nombre (opcional)"
            className="campo-texto"
            style={{ flex: 1 }}
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={agregandoPasskey}
            style={{ padding: '0 14px', fontFamily: 'var(--font-body)', fontSize: 12, letterSpacing: 'normal' }}
          >
            {agregandoPasskey ? 'Agregando…' : 'Agregar'}
          </button>
        </form>
        {errorPasskey && (
          <p role="alert" style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--color-estado-fallida-fg)' }}>
            {errorPasskey}
          </p>
        )}
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
