import { useState, type FormEvent } from 'react';
import { authClient } from '../services/auth-client';
import MarcasEsquina from '../theme/MarcasEsquina';

type Modo = 'iniciar-sesion' | 'crear-cuenta' | 'verifica-tu-correo';

/** Registro abierto + verificación de correo (FR-001/FR-002) — quien inicia sesión con éxito lo detecta authClient.useSession() en App.tsx, reactivamente, sin callback. */
export default function Login() {
  const [modo, setModo] = useState<Modo>('iniciar-sesion');
  const [correo, setCorreo] = useState('');
  const [contraseña, setContraseña] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      </form>
    </section>
  );
}
