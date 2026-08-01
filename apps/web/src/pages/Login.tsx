import { useEffect, useState, type FormEvent } from 'react';
import { authClient } from '../services/auth-client';
import MarcasEsquina from '../theme/MarcasEsquina';

type Modo = 'iniciar-sesion' | 'crear-cuenta' | 'verifica-tu-correo' | 'verificar-2fa';

/** Registro abierto + verificación de correo (FR-001/FR-002) — quien inicia sesión con éxito lo detecta authClient.useSession() en App.tsx, reactivamente, sin callback. */
export default function Login() {
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

  if (modo === 'verificar-2fa') {
    return (
      <section
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-body)',
        }}
      >
        <form
          onSubmit={manejarVerificar2FA}
          className="card"
          style={{ padding: 24, width: 280, display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <MarcasEsquina />
          <h1 className="heading" style={{ margin: 0, fontSize: 24 }}>
            Verificación en dos pasos
          </h1>
          <label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            {usarCodigoRespaldo ? 'Código de respaldo' : 'Código de tu app autenticadora'}
            <input
              type="text"
              inputMode={usarCodigoRespaldo ? 'text' : 'numeric'}
              autoComplete="one-time-code"
              value={codigo2FA}
              onChange={(e) => setCodigo2FA(e.target.value)}
              autoFocus
              required
              style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
            />
          </label>
          {error && <p role="alert" style={{ margin: 0, fontSize: 12, color: 'var(--color-estado-fallida-fg)' }}>{error}</p>}
          <button type="submit" className="btn-primary" disabled={enviando} style={{ padding: '8px 0' }}>
            {enviando ? 'Verificando…' : 'Verificar'}
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setCodigo2FA('');
              setUsarCodigoRespaldo((v) => !v);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-muted)',
              fontSize: 12,
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            {usarCodigoRespaldo ? 'Usar el código de la app autenticadora' : 'Perdí acceso — usar un código de respaldo'}
          </button>
        </form>
      </section>
    );
  }

  if (modo === 'verifica-tu-correo') {
    return (
      <section
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-body)',
        }}
      >
        <div className="card" style={{ padding: 24, width: 280, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <MarcasEsquina />
          <h1 className="heading" style={{ margin: 0, fontSize: 24 }}>
            Verifica tu correo
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
            Te enviamos un enlace a <strong>{correo}</strong>. Ábrelo para activar tu cuenta — después podrás
            iniciar sesión desde aquí.
          </p>
          <button
            type="button"
            className="btn-primary"
            style={{ padding: '8px 0' }}
            onClick={() => setModo('iniciar-sesion')}
          >
            Ya verifiqué, ingresar
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-body)',
      }}
    >
      <form onSubmit={manejarSubmit} className="card" style={{ padding: 24, width: 280, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <MarcasEsquina />
        <h1 className="heading" style={{ margin: 0, fontSize: 24 }}>
          MyIvo
        </h1>
        <label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          Correo
          <input
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            autoComplete="email"
            required
            style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
          />
        </label>
        <label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          Contraseña
          <input
            type="password"
            value={contraseña}
            onChange={(e) => setContraseña(e.target.value)}
            autoComplete={modo === 'iniciar-sesion' ? 'current-password' : 'new-password'}
            minLength={modo === 'crear-cuenta' ? 8 : undefined}
            required
            style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
          />
        </label>
        {error && <p role="alert" style={{ margin: 0, fontSize: 12, color: 'var(--color-estado-fallida-fg)' }}>{error}</p>}
        <button type="submit" className="btn-primary" disabled={enviando} style={{ padding: '8px 0' }}>
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
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--color-text-muted)',
            fontSize: 12,
            cursor: 'pointer',
            textDecoration: 'underline',
            padding: 0,
          }}
        >
          {modo === 'iniciar-sesion' ? '¿No tienes cuenta? Crear una' : '¿Ya tienes cuenta? Ingresar'}
        </button>

        {/* Mismos 3 botones sirvan para iniciar sesión o crear cuenta — no
            todos los proveedores necesariamente están configurados en el
            backend; si alguno no lo está, el error de authClient.signIn.social
            se muestra igual que cualquier otro error de este formulario. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 0' }}>
          <span style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>o</span>
          <span style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
        </div>
        <button
          type="button"
          onClick={() => manejarSocial('google')}
          style={{ padding: '8px 0', cursor: 'pointer' }}
        >
          Continuar con Google
        </button>
        <button
          type="button"
          onClick={() => manejarSocial('microsoft')}
          style={{ padding: '8px 0', cursor: 'pointer' }}
        >
          Continuar con Microsoft
        </button>
        <button
          type="button"
          onClick={() => manejarSocial('github')}
          style={{ padding: '8px 0', cursor: 'pointer' }}
        >
          Continuar con GitHub
        </button>
        {modo === 'iniciar-sesion' && (
          <button type="button" onClick={manejarPasskey} style={{ padding: '8px 0', cursor: 'pointer' }}>
            Ingresar con passkey
          </button>
        )}
      </form>
    </section>
  );
}
