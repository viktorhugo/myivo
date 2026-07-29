# Data Model: Reporte anual de compras elegibles para renta

Extiende `specs/001-captura-facturas/data-model.md` (entidad `Factura`) y `specs/003-validacion-dian/data-model.md` (entidad `ValidacionDian`) — esta feature no modifica ninguna de las dos. No introduce ninguna entidad persistida nueva (spec.md § Key Entities): el "Reporte Anual" es una vista calculada en el momento de la consulta, no una tabla.

## ReporteAnual (vista calculada, no persistida)

Forma de la respuesta de `GET /reportes/anual` — ver `contracts/api.md`.

| Campo | Tipo | Notas |
|---|---|---|
| `anio` | int | El año gravable consultado (FR-001) |
| `totalCentavos` | int | Suma de `totalCentavos` de las facturas elegibles de ese año, **solo COP** (FR-002, FR-009) |
| `conteo` | int | Cantidad de facturas que componen `totalCentavos` — mismo filtro COP-only (FR-003: "cuántas facturas componen *ese* total"), distinto del conteo multi-moneda que ya expone el Listado hoy |
| `desglosePorMes` | `DesgloseMes[12]` | Siempre los 12 meses, en orden, incluso los de $0 (FR-004, Acceptance Scenario 3) |

### DesgloseMes

| Campo | Tipo | Notas |
|---|---|---|
| `mes` | int (1-12) | |
| `totalCentavos` | int | COP-only, mismo criterio que el total del reporte |
| `conteo` | int | COP-only |

## FilaExportacion (solo dentro del archivo exportado, US2)

A diferencia del resumen agregado (COP-only, ver abajo), FR-010 pide literalmente "una fila por cada factura elegible del año" — sin el calificador de "ese total" que sí tienen FR-002/FR-003. Por eso `FilaExportacion` incluye **todas** las facturas con `elegibilidadTributaria = true` y `eliminadaEn = null` del año, en cualquier moneda — una factura elegible en moneda extranjera no debe desaparecer silenciosamente del soporte que se le entrega a un contador solo porque no entra en el total en COP (Edge Cases del spec: "queda fuera del **total agregado**", no del reporte).

| Campo | Tipo | Notas |
|---|---|---|
| `comercioNombre` | string | |
| `fechaHoraCompra` | timestamp | |
| `totalCentavos` | int | |
| `moneda` | string | Necesario precisamente porque esta tabla no es COP-only — sin este campo, una fila en moneda extranjera se leería como si fuera COP (constitution Principio II) |
| `tipoDocumento` | enum (feature 001) | |
| `tieneValidacionDian` | bool | `true` si `ultimaValidacionDian` no es `null` (FR-006) — el archivo exportado guarda solo si ya se validó o no, no el resultado completo |

## Validaciones de dominio

- El `ReporteAnual` MUST derivarse exclusivamente de facturas con `elegibilidadTributaria = true`, `eliminadaEn = null`, y `moneda = 'COP'`. Este último filtro es más estricto que `FacturaRepository.listar()` en general (cuyo `items`/`conteo` incluyen todas las monedas — FR-027 de la feature 001, solo `sumaTotal` es COP-only ahí). Aquí FR-003 liga explícitamente "cuántas facturas" a "ese total" (COP), así que el servicio del reporte MUST filtrar `items` por `moneda === 'COP'` antes de contar o agrupar por mes — usar `ResultadoListado.conteo` directamente sería incorrecto: incluiría facturas en otras monedas que no están en `totalCentavos`, produciendo un conteo que no cuadra con el total (justo el tipo de "número plausible y equivocado" que constitution Principio VIII existe para evitar).
- El `ReporteAnual` MUST NOT escribir ni recalcular `Factura.elegibilidadTributaria` ni `Factura.tipoDocumento` — consume la clasificación ya existente, nunca la cambia (FR-002, constitution Principio IV).
- El estado de validación DIAN (`ultimaValidacionDian`, ya calculado por `FacturaRepository.listar()` desde la feature 003) es puramente informativo en el reporte (FR-006) — no participa en el filtro de qué factura entra al reporte.
- **Decisión de diseño — reconciliación con el Listado (SC-004)**: para que "abrir el listado filtrado" (FR-005) muestre exactamente las facturas que componen el reporte — ni una de más en moneda extranjera — `FiltrosFactura` (`apps/api/src/modules/invoices/dto/filtrar-facturas.dto.ts`) se extiende con un campo `moneda` opcional (mismo patrón que los filtros ya existentes: si se omite, el comportamiento actual del Listado no cambia en nada). El enlace que construye el reporte pasa `moneda=COP` explícitamente junto con `fechaDesde`/`fechaHasta`/`elegibilidad=true`.

## Regla de dominio: desglose mensual (US1)

Dado un año y la lista de facturas elegibles en COP de ese año (ya filtradas por el servicio, ver arriba), la función pura de dominio agrupa por el mes de `fechaHoraCompra` y devuelve los 12 `DesgloseMes`, incluyendo los meses sin ninguna factura con `{ totalCentavos: 0, conteo: 0 }` (FR-004) — nunca omite un mes vacío de la lista.

## Rango de años disponibles (research.md § 4)

Consulta agregada nueva (no una entidad): `obtenerAnioMasAntiguo()` en `FacturaRepository` devuelve el año de la factura no eliminada más antigua (`null` si no hay ninguna). El frontend arma el rango completo del selector como `[anioMin ?? anioActual, anioActual]` — el año en curso lo calcula localmente (mismo valor ya usado para el default de FR-001), sin pedírselo al backend, para no arriesgar una desincronización servidor/cliente sobre qué año es "hoy".
