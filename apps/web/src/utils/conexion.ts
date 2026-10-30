import { useEffect, useState } from 'react';

/** US1/FR-007 (specs/009): sin esto, abrir la app empaquetada sin conexión deja la
 * sesión en estado "pendiente" para siempre (la request nunca resuelve), y App.tsx
 * muestra una pantalla en blanco en vez de explicar qué pasa. */
export function useEnLinea(): boolean {
  const [enLinea, setEnLinea] = useState(navigator.onLine);

  useEffect(() => {
    function manejarCambio() {
      setEnLinea(navigator.onLine);
    }
    window.addEventListener('online', manejarCambio);
    window.addEventListener('offline', manejarCambio);
    return () => {
      window.removeEventListener('online', manejarCambio);
      window.removeEventListener('offline', manejarCambio);
    };
  }, []);

  return enLinea;
}
