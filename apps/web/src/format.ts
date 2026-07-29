/**
 * Intl separa el símbolo de moneda con un espacio duro (U+00A0) que el diseño
 * de referencia no lleva (`$219.662`, no `$ 219.662`). Se define por código de
 * carácter en vez de escribirlo literal: un U+00A0 dentro del fuente es
 * indistinguible de un espacio normal a simple vista.
 */
const ESPACIO_DURO = String.fromCharCode(0x00a0);

/**
 * Formato del diseño de referencia: `$219.662` para COP (sin decimales) y
 * `US$24,99` para otras monedas. Los decimales de COP se fijan explícitamente
 * porque su valor por defecto depende de la versión de ICU del navegador — sin
 * esto, el mismo monto se ve distinto según el entorno.
 */
export function formatearCentavos(centavos: number | null, moneda: string): string {
  if (centavos === null) {
    return '—';
  }
  const valor = centavos / 100;
  const decimales = moneda === 'COP' ? 0 : 2;
  try {
    const formateado = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: moneda,
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    }).format(valor);
    return formateado.split(ESPACIO_DURO).join('');
  } catch {
    return `${valor.toFixed(decimales)} ${moneda}`;
  }
}

/** Día y hora por separado — permite resaltar solo la hora (bottom sheet de duplicado). */
export function formatearFechaPartes(iso: string | null): { dia: string; hora: string } {
  if (!iso) {
    return { dia: '—', hora: '' };
  }
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) {
    return { dia: iso, hora: '' };
  }
  const dia = fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  const hora = fecha.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true });
  return { dia, hora };
}

/** Formato compacto del diseño de referencia: "28 jun · 6:12 p.m." */
export function formatearFecha(iso: string | null): string {
  const { dia, hora } = formatearFechaPartes(iso);
  return hora ? `${dia} · ${hora}` : dia;
}

/**
 * Diferencia legible entre dos fechas ("2 minutos de diferencia", "3 horas de
 * diferencia") — usada en el subtítulo del bottom sheet de duplicado probable
 * para explicar por qué dos facturas parecen la misma compra.
 */
export function formatearDiferenciaTiempo(isoA: string | null, isoB: string | null): string | null {
  if (!isoA || !isoB) {
    return null;
  }
  const a = new Date(isoA).getTime();
  const b = new Date(isoB).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) {
    return null;
  }
  const minutos = Math.round(Math.abs(b - a) / 60000);
  if (minutos < 60) {
    return `${minutos || 1} minuto${minutos === 1 ? '' : 's'} de diferencia`;
  }
  const horas = Math.round(minutos / 60);
  if (horas < 24) {
    return `${horas} hora${horas === 1 ? '' : 's'} de diferencia`;
  }
  const dias = Math.round(horas / 24);
  return `${dias} día${dias === 1 ? '' : 's'} de diferencia`;
}

/**
 * Encabezado de grupo de mes del listado — el diseño muestra solo el mes
 * ("Julio"); el año se añade únicamente cuando no es el año en curso, para no
 * perder la referencia temporal en datos de años anteriores.
 */
export function formatearMesDeGrupo(iso: string | null): string {
  if (!iso) {
    return 'Sin fecha';
  }
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) {
    return 'Sin fecha';
  }
  const mes = fecha.toLocaleDateString('es-CO', { month: 'long' });
  const anio = fecha.getFullYear();
  return anio === new Date().getFullYear() ? mes : `${mes} ${anio}`;
}

/** Nombre del mes (1-12) para el desglose del reporte anual — sin depender de una fecha concreta. */
export function formatearNombreMes(mes: number): string {
  return new Date(2000, mes - 1, 1).toLocaleDateString('es-CO', { month: 'long' });
}
