/**
 * Duplicado exacto por CUFE (FR-019): dos documentos que comparten el mismo
 * CUFE/CUDE MUST quedar marcados como duplicados de forma automática, sin
 * preguntar al usuario. Un CUFE `null` nunca cuenta como coincidencia — la
 * ausencia de CUFE no es una coincidencia, es la razón por la que existe el
 * mecanismo difuso aparte (comercio_fecha_total_similar, FR-020).
 */
export function esDuplicadoExactoPorCufe(cufeA: string | null, cufeB: string | null): boolean {
  return cufeA !== null && cufeB !== null && cufeA === cufeB;
}
