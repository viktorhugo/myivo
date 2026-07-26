export function formatearCentavos(centavos: number | null, moneda: string): string {
  if (centavos === null) {
    return '—';
  }
  const valor = centavos / 100;
  try {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: moneda }).format(valor);
  } catch {
    return `${valor.toFixed(2)} ${moneda}`;
  }
}

export function formatearFecha(iso: string | null): string {
  if (!iso) {
    return '—';
  }
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? iso : fecha.toLocaleString('es-CO');
}
