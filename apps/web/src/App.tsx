import { useState } from 'react';
import Captura from './pages/Captura';
import Detalle from './pages/Detalle';

export default function App() {
  const [facturaSeleccionada, setFacturaSeleccionada] = useState<string | null>(null);

  return (
    <main>
      {facturaSeleccionada ? (
        <Detalle facturaId={facturaSeleccionada} onVolver={() => setFacturaSeleccionada(null)} />
      ) : (
        <Captura onSeleccionar={setFacturaSeleccionada} />
      )}
    </main>
  );
}
