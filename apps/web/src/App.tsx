import { useEffect, useState } from 'react';
import Captura from './pages/Captura';
import Detalle from './pages/Detalle';
import Listado from './pages/Listado';
import Login from './pages/Login';
import SelectorTema from './theme/SelectorTema';
import { useTheme } from './theme/useTheme';
import { cerrarSesion, haySesionActiva } from './services/auth';

type Vista = { tipo: 'listado' } | { tipo: 'captura' } | { tipo: 'detalle'; facturaId: string };

export default function App() {
  const [vista, setVista] = useState<Vista>({ tipo: 'listado' });
  const [autenticado, setAutenticado] = useState<boolean | null>(null);
  const { preferencia, temaResuelto, setPreferencia } = useTheme();

  useEffect(() => {
    haySesionActiva().then(setAutenticado);
  }, []);

  if (autenticado === null) {
    return null;
  }

  if (!autenticado) {
    return <Login onAutenticado={() => setAutenticado(true)} />;
  }

  return (
    /* La barra de chrome (tema + salir) es `sticky`, no `fixed`: así ocupa su
       propio espacio en el flujo y nunca se encima con el encabezado de cada
       pantalla, sin depender de que el padding del contenedor la compense. */
    <main>
      <div
        style={{
          position: 'sticky',
          top: 0,
          height: 44,
          zIndex: 10,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 20px',
          background: 'var(--color-bg)',
          boxSizing: 'border-box',
        }}
      >
        <SelectorTema preferencia={preferencia} onCambiar={setPreferencia} />
        <button
          type="button"
          onClick={() => cerrarSesion().then(() => setAutenticado(false))}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            background: 'transparent',
            color: 'var(--color-text-muted)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-button)',
            padding: '4px 8px',
            cursor: 'pointer',
          }}
        >
          Salir
        </button>
      </div>
      {vista.tipo === 'captura' && (
        <Captura
          tema={temaResuelto}
          onSeleccionar={(facturaId) => setVista({ tipo: 'detalle', facturaId })}
          onVolver={() => setVista({ tipo: 'listado' })}
        />
      )}
      {vista.tipo === 'detalle' && (
        <Detalle
          tema={temaResuelto}
          facturaId={vista.facturaId}
          onVolver={() => setVista({ tipo: 'listado' })}
        />
      )}
      {vista.tipo === 'listado' && (
        <Listado
          tema={temaResuelto}
          onAbrirFactura={(facturaId) => setVista({ tipo: 'detalle', facturaId })}
          onCapturar={() => setVista({ tipo: 'captura' })}
        />
      )}
    </main>
  );
}
