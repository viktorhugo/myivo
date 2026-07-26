import { useState, type ChangeEvent } from 'react';
import { subirFacturas, type FacturaDto } from '../services/invoices';
import { ETIQUETA_ESTADO } from '../etiquetas';

export default function Captura({
  onSeleccionar,
  onVolver,
}: {
  onSeleccionar: (facturaId: string) => void;
  onVolver: () => void;
}) {
  const [facturas, setFacturas] = useState<FacturaDto[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function manejarSeleccion(event: ChangeEvent<HTMLInputElement>) {
    const archivos = event.target.files;
    if (!archivos || archivos.length === 0) {
      return;
    }

    setSubiendo(true);
    setError(null);
    try {
      const nuevas = await subirFacturas(Array.from(archivos));
      setFacturas((actuales) => [...nuevas, ...actuales]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir las facturas');
    } finally {
      setSubiendo(false);
      event.target.value = '';
    }
  }

  return (
    <section>
      <button type="button" onClick={onVolver}>
        ← Volver al listado
      </button>

      <h1>Capturar facturas</h1>

      <label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={manejarSeleccion}
          disabled={subiendo}
        />
        {subiendo ? 'Subiendo…' : 'Tomar foto o subir imágenes'}
      </label>

      {error && <p role="alert">{error}</p>}

      <ul>
        {facturas.map((factura) => (
          <li key={factura.id}>
            <button type="button" onClick={() => onSeleccionar(factura.id)}>
              <strong>{ETIQUETA_ESTADO[factura.estado]}</strong> — {factura.id}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
