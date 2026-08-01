import { useState } from 'react';
import Captura from './pages/Captura';
import ConciliacionDian from './pages/ConciliacionDian';
import CuentaPropia from './pages/CuentaPropia';
import Detalle from './pages/Detalle';
import Listado, { type FiltrosListadoIniciales } from './pages/Listado';
import ReporteAnual from './pages/ReporteAnual';
import Login from './pages/Login';
import SelectorTema from './theme/SelectorTema';
import { useTheme } from './theme/useTheme';
import { authClient } from './services/auth-client';

type Vista =
  | { tipo: 'listado'; filtrosIniciales?: FiltrosListadoIniciales }
  | { tipo: 'captura' }
  | { tipo: 'detalle'; facturaId: string }
  | { tipo: 'conciliacion-dian' }
  | { tipo: 'reporte-anual' }
  | { tipo: 'cuenta-propia' };

export default function App() {
  const [vista, setVista] = useState<Vista>({ tipo: 'listado' });
  const { data: sesion, isPending: sesionPendiente } = authClient.useSession();
  const { preferencia, temaResuelto, setPreferencia } = useTheme();

  if (sesionPendiente) {
    return null;
  }

  if (!sesion) {
    return <Login />;
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
          onClick={() => setVista({ tipo: 'cuenta-propia' })}
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
          Mi cuenta
        </button>
        <button
          type="button"
          onClick={() => authClient.signOut()}
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
          filtrosIniciales={vista.filtrosIniciales}
          onAbrirFactura={(facturaId) => setVista({ tipo: 'detalle', facturaId })}
          onCapturar={() => setVista({ tipo: 'captura' })}
          onConciliarDian={() => setVista({ tipo: 'conciliacion-dian' })}
          onAbrirReporte={() => setVista({ tipo: 'reporte-anual' })}
        />
      )}
      {vista.tipo === 'conciliacion-dian' && (
        <ConciliacionDian tema={temaResuelto} onVolver={() => setVista({ tipo: 'listado' })} />
      )}
      {vista.tipo === 'reporte-anual' && (
        <ReporteAnual
          tema={temaResuelto}
          onVolver={() => setVista({ tipo: 'listado' })}
          onAbrirListado={(filtrosIniciales) => setVista({ tipo: 'listado', filtrosIniciales })}
        />
      )}
      {vista.tipo === 'cuenta-propia' && (
        <CuentaPropia tema={temaResuelto} onVolver={() => setVista({ tipo: 'listado' })} />
      )}
    </main>
  );
}
