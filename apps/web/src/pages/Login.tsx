import { useEffect, useState, type FormEvent } from 'react';
import { authClient } from '../services/auth-client';
import CampoContraseña from '../theme/CampoContraseña';
import MarcasEsquina from '../theme/MarcasEsquina';
import SelectorTema from '../theme/SelectorTema';
import { obtenerIcono } from '../theme/iconos';
import type { TemaPreferencia, TemaResuelto } from '../theme/useTheme';

type Modo = 'iniciar-sesion' | 'crear-cuenta' | 'verifica-tu-correo' | 'verificar-2fa';

const estiloEnlace = {
  background: 'transparent',
  border: 'none',
  color: 'var(--color-accent-fg-tint)',
  fontSize: 13,
  cursor: 'pointer',
  textDecoration: 'underline',
  textUnderlineOffset: 3,
  padding: 2,
} as const;

const estiloBotonProveedor = {
  border: '1px solid var(--color-border)',
  background: 'transparent',
  color: 'var(--color-text)',
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  fontWeight: 500,
  padding: 9,
  borderRadius: 'var(--radius-button)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
} as const;

/** Registro abierto + verificación de correo (FR-001/FR-002) — quien inicia sesión con éxito lo detecta authClient.useSession() en App.tsx, reactivamente, sin callback. */
export default function Login({
  tema,
  preferencia,
  onCambiarTema,
}: {
  tema: TemaResuelto;
  preferencia: TemaPreferencia;
  onCambiarTema: (preferencia: TemaPreferencia) => void;
}) {
  const [modo, setModo] = useState<Modo>('iniciar-sesion');
  const [correo, setCorreo] = useState('');
  const [contraseña, setContraseña] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [codigo2FA, setCodigo2FA] = useState('');
  const [usarCodigoRespaldo, setUsarCodigoRespaldo] = useState(false);

  // Disparado por auth-client.ts (onTwoFactorRedirect) cuando email/contraseña
  // o passkey son válidos pero la cuenta tiene 2FA activa — sin esto, Better
  // Auth deja la sesión a medias sin ninguna forma de completarla desde aquí.
  useEffect(() => {
    function manejarRequiereTotp() {
      setError(null);
      setModo('verificar-2fa');
    }
    window.addEventListener('myivo:requiere-totp', manejarRequiereTotp);
    return () => window.removeEventListener('myivo:requiere-totp', manejarRequiereTotp);
  }, []);

  async function manejarSubmit(event: FormEvent) {
    event.preventDefault();
    setEnviando(true);
    setError(null);

    if (modo === 'iniciar-sesion') {
      const { error: errorSesion } = await authClient.signIn.email({ email: correo, password: contraseña });
      if (errorSesion) {
        setError(errorSesion.message ?? 'No se pudo iniciar sesión');
      }
    } else {
      // name es obligatorio para Better Auth pero esta app no lo muestra en
      // ninguna pantalla — un valor derivado del correo evita pedir un campo
      // que el registro (spec.md US1) nunca pidió.
      const { error: errorRegistro } = await authClient.signUp.email({
        email: correo,
        password: contraseña,
        name: correo.split('@')[0] ?? correo,
      });
      if (errorRegistro) {
        setError(errorRegistro.message ?? 'No se pudo crear la cuenta');
      } else {
        setModo('verifica-tu-correo');
      }
    }

    setEnviando(false);
  }

  async function manejarPasskey() {
    setError(null);
    const { error: errorPasskey } = await authClient.signIn.passkey();
    if (errorPasskey) {
      setError(errorPasskey.message ?? 'No se pudo iniciar sesión con el passkey');
    }
  }

  async function manejarVerificar2FA(event: FormEvent) {
    event.preventDefault();
    setEnviando(true);
    setError(null);
    const { error: error2FA } = usarCodigoRespaldo
      ? await authClient.twoFactor.verifyBackupCode({ code: codigo2FA })
      : await authClient.twoFactor.verifyTotp({ code: codigo2FA });
    if (error2FA) {
      setError(error2FA.message ?? 'Código inválido');
    }
    setEnviando(false);
  }

  const IconoHuella = obtenerIcono('huella', tema);
  // Tamaños del título — más grandes/versalitas en Industry (Barlow Condensed),
  // más compactos en Nocturne (Inter), y un escalón menos en los pasos
  // "Verifica tu correo"/"Verificación en dos pasos" que en el formulario.
  const tituloFormulario = tema === 'nocturne' ? 22 : 24;
  const tituloSecundario = tema === 'nocturne' ? 20 : 22;
  const letterSpacingTitulo = tema === 'nocturne' ? '-0.015em' : '0.02em';
  // Tarjeta "flotante" en Nocturne (anillo + sombra) — en Industry el borde de
  // `.card` ya es suficiente, coherente con el resto de la app.
  const sombraTarjeta = tema === 'nocturne' ? '0 0 0 1px #3f424d, 0 6px 18px rgba(0, 0, 0, 0.55)' : undefined;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-body)' }}>
      <div
        style={{
          height: 44,
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 8,
          padding: '0 20px',
        }}
      >
        <SelectorTema preferencia={preferencia} onCambiar={onCambiarTema} />
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div className="card" style={{ width: 280, padding: 24, display: 'flex', flexDirection: 'column', gap: 12, boxShadow: sombraTarjeta }}>
          <MarcasEsquina />

          {modo === 'verificar-2fa' ? (
            <form onSubmit={manejarVerificar2FA} style={{ display: 'contents' }}>
              <h1 className="heading" style={{ margin: 0, fontSize: tituloSecundario, letterSpacing: letterSpacingTitulo }}>
                Verificación en dos pasos
              </h1>
              <div>
                <label htmlFor="codigo-2fa" style={{ display: 'block', fontSize: 12, color: 'var(--color-text-label)', marginBottom: 5 }}>
                  {usarCodigoRespaldo ? 'Código de respaldo' : 'Código de tu app autenticadora'}
                </label>
                <input
                  id="codigo-2fa"
                  type="text"
                  inputMode={usarCodigoRespaldo ? 'text' : 'numeric'}
                  autoComplete="one-time-code"
                  value={codigo2FA}
                  onChange={(e) => setCodigo2FA(e.target.value)}
                  autoFocus
                  required
                  className="campo-texto"
                />
              </div>
              {error && <p role="alert" style={{ margin: 0, fontSize: 12, color: 'var(--color-estado-fallida-fg)' }}>{error}</p>}
              <button type="submit" className="btn-primary" disabled={enviando} style={{ padding: 10 }}>
                {enviando ? 'Verificando…' : 'Verificar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setCodigo2FA('');
                  setUsarCodigoRespaldo((v) => !v);
                }}
                style={estiloEnlace}
              >
                {usarCodigoRespaldo ? 'Usar el código de la app autenticadora' : 'Perdí acceso — usar un código de respaldo'}
              </button>
              <button
                type="button"
                onClick={() => setModo('iniciar-sesion')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-text-muted-2)',
                  fontSize: 10,
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: '6px 0 0',
                  alignSelf: 'flex-start',
                }}
              >
                ← volver al formulario
              </button>
            </form>
          ) : modo === 'verifica-tu-correo' ? (
            <>
              <h1 className="heading" style={{ margin: 0, fontSize: tituloSecundario, letterSpacing: letterSpacingTitulo }}>
                Verifica tu correo
              </h1>
              <p style={{ margin: 0, fontSize: tema === 'nocturne' ? 13.5 : 14, color: 'var(--color-text-label)', textWrap: 'pretty' }}>
                Te enviamos un enlace a <strong>{correo}</strong>. Ábrelo para activar tu cuenta — después podrás
                iniciar sesión desde aquí.
              </p>
              <button type="button" className="btn-primary" style={{ padding: 10 }} onClick={() => setModo('iniciar-sesion')}>
                Ya verifiqué, ingresar
              </button>
            </>
          ) : (
            <form onSubmit={manejarSubmit} style={{ display: 'contents' }}>
              <h1 className="heading" style={{ margin: 0, fontSize: tituloFormulario, letterSpacing: letterSpacingTitulo }}>
                Cufeo
              </h1>
              <div>
                <label htmlFor="correo" style={{ display: 'block', fontSize: 12, color: 'var(--color-text-label)', marginBottom: 5 }}>
                  Correo
                </label>
                <input
                  id="correo"
                  type="email"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  autoComplete="email"
                  required
                  placeholder="tú@correo.com"
                  className="campo-texto"
                />
              </div>
              <CampoContraseña
                tema={tema}
                etiqueta="Contraseña"
                valor={contraseña}
                onCambiar={setContraseña}
                autoComplete={modo === 'iniciar-sesion' ? 'current-password' : 'new-password'}
                {...(modo === 'crear-cuenta' ? { minLength: 8 } : {})}
              />
              {error && <p role="alert" style={{ margin: 0, fontSize: 12, color: 'var(--color-estado-fallida-fg)' }}>{error}</p>}
              <button type="submit" className="btn-primary" disabled={enviando} style={{ padding: 10 }}>
                {enviando
                  ? modo === 'iniciar-sesion'
                    ? 'Ingresando…'
                    : 'Creando cuenta…'
                  : modo === 'iniciar-sesion'
                    ? 'Ingresar'
                    : 'Crear cuenta'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setModo(modo === 'iniciar-sesion' ? 'crear-cuenta' : 'iniciar-sesion');
                }}
                style={estiloEnlace}
              >
                {modo === 'iniciar-sesion' ? '¿No tienes cuenta? Crear una' : '¿Ya tienes cuenta? Ingresar'}
              </button>

              {modo === 'iniciar-sesion' && (
                <button type="button" onClick={manejarPasskey} style={estiloBotonProveedor}>
                  <IconoHuella size={16} strokeWidth={tema === 'nocturne' ? 1.7 : 1.5} />
                  Ingresar con passkey
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
