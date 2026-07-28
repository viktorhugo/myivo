import { useState, type FormEvent } from 'react';
import { iniciarSesion } from '../services/auth';
import MarcasEsquina from '../theme/MarcasEsquina';

/** Autenticación de un solo usuario (FR-030) — sin registro, sin recuperación de contraseña. */
export default function Login({ onAutenticado }: { onAutenticado: () => void }) {
  const [usuario, setUsuario] = useState('');
  const [contraseña, setContraseña] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function manejarSubmit(event: FormEvent) {
    event.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await iniciarSesion(usuario, contraseña);
      onAutenticado();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión');
    } finally {
      setEnviando(false);
    }
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
          Usuario
          <input
            type="text"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoComplete="username"
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
            autoComplete="current-password"
            required
            style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
          />
        </label>
        {error && <p role="alert" style={{ margin: 0, fontSize: 12, color: 'var(--color-estado-fallida-fg)' }}>{error}</p>}
        <button type="submit" className="btn-primary" disabled={enviando} style={{ padding: '8px 0' }}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </section>
  );
}
