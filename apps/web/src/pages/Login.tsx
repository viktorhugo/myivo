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

  /**
   * Redirección de página completa (no popup) — el navegador navega al
   * proveedor y, al terminar, Better Auth lo trae de vuelta a callbackURL.
   * Sirve para iniciar sesión Y para registrar una cuenta nueva por igual
   * (Better Auth decide cuál según si el correo ya existe) — un solo botón
   * por proveedor, sin distinguir "crear-cuenta" de "iniciar-sesion" como sí
   * hace el formulario de correo/contraseña.
   */
  async function manejarSocial(proveedor: 'google' | 'microsoft' | 'github') {
    setError(null);
    const { error: errorSocial } = await authClient.signIn.social({
      provider: proveedor,
      callbackURL: window.location.origin,
    });
    if (errorSocial) {
      setError(errorSocial.message ?? 'No se pudo continuar con ese proveedor');
    }
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
                MyIvo
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

              {/* Mismos 3 botones sirven para iniciar sesión o crear cuenta —
                  no todos los proveedores necesariamente están configurados
                  en el backend; si alguno no lo está, el error de
                  authClient.signIn.social se muestra igual que cualquier
                  otro error de este formulario. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0' }}>
                <span style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>o</span>
                <span style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
              </div>
              <button type="button" onClick={() => manejarSocial('google')} style={estiloBotonProveedor}>
                <IconoGoogle />
                Continuar con Google
              </button>
              <button type="button" onClick={() => manejarSocial('microsoft')} style={estiloBotonProveedor}>
                <IconoMicrosoft />
                Continuar con Microsoft
              </button>
              <button type="button" onClick={() => manejarSocial('github')} style={estiloBotonProveedor}>
                <IconoGitHub color={tema === 'nocturne' ? '#e9e9ed' : '#1d1f20'} />
                Continuar con GitHub
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

/** Logos de marca — colores fijos de cada proveedor, no siguen el tema (igual en Industry/Nocturne). */
function IconoGoogle() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.3 1 7.3 2.7l5.7-5.7C33.7 6.5 29.1 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c2.8 0 5.3 1 7.3 2.7l5.7-5.7C33.7 6.5 29.1 4.5 24 4.5c-7.6 0-14.1 4.3-17.4 10.6z" />
      <path fill="#4CAF50" d="M24 43.5c5 0 9.6-1.9 13-5.1l-6-4.9c-2 1.5-4.5 2.5-7 2.5-5.3 0-9.7-3.6-11.3-8.4l-6.6 5.1C9.7 39.1 16.3 43.5 24 43.5z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l6 4.9c-.4.4 6.9-5 6.9-15.6 0-1.2-.1-2.4-.3-3.5z" />
    </svg>
  );
}

function IconoMicrosoft() {
  return (
    <svg width="16" height="16" viewBox="0 0 23 23" aria-hidden="true">
      <rect x="1" y="1" width="10" height="10" fill="#f25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7fba00" />
      <rect x="1" y="12" width="10" height="10" fill="#00a4ef" />
      <rect x="12" y="12" width="10" height="10" fill="#ffb900" />
    </svg>
  );
}

function IconoGitHub({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.79-.25.79-.55v-2.17c-3.2.7-3.87-1.36-3.87-1.36-.53-1.33-1.29-1.68-1.29-1.68-1.05-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a10.9 10.9 0 015.8 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.76.12 3.05.74.8 1.18 1.83 1.18 3.08 0 4.41-2.68 5.38-5.24 5.67.41.36.78 1.06.78 2.15v3.19c0 .3.21.66.8.55A11.5 11.5 0 0023.5 12C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}
