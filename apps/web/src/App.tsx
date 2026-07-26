import { useState } from 'react';
import Captura from './pages/Captura';
import Detalle from './pages/Detalle';
import Listado from './pages/Listado';

type Vista = { tipo: 'listado' } | { tipo: 'captura' } | { tipo: 'detalle'; facturaId: string };

export default function App() {
  const [vista, setVista] = useState<Vista>({ tipo: 'listado' });

  return (
    <main>
      {vista.tipo === 'captura' && (
        <Captura
          onSeleccionar={(facturaId) => setVista({ tipo: 'detalle', facturaId })}
          onVolver={() => setVista({ tipo: 'listado' })}
        />
      )}
      {vista.tipo === 'detalle' && (
        <Detalle facturaId={vista.facturaId} onVolver={() => setVista({ tipo: 'listado' })} />
      )}
      {vista.tipo === 'listado' && (
        <Listado
          onAbrirFactura={(facturaId) => setVista({ tipo: 'detalle', facturaId })}
          onCapturar={() => setVista({ tipo: 'captura' })}
        />
      )}
    </main>
  );
}
