# API Contract: Reporte anual de compras elegibles para renta

Extiende `specs/001-captura-facturas/contracts/api.md` y `specs/003-validacion-dian/contracts/api.md` — todos los endpoints ya documentados ahí permanecen sin cambios de forma, salvo la extensión puntual descrita al final de este documento. Esta feature agrega los siguientes.

## Consultar el reporte de un año (US1)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/reportes/anual?anio=YYYY` | `anio` requerido (entero de 4 dígitos). Devuelve el `ReporteAnual` (data-model.md): `{ anio, totalCentavos, conteo, desglosePorMes: DesgloseMes[12] }`, calculado sobre facturas con `elegibilidadTributaria: true`, `eliminadaEn: null`, `moneda: "COP"` y `fechaHoraCompra` dentro de ese año. `400` si `anio` falta o no es un entero válido. Nunca `404` — un año sin datos responde `200` con `totalCentavos: 0, conteo: 0` y los 12 meses en $0 (FR-001, Acceptance Scenario 7). El año por defecto al abrir la pantalla (FR-001) lo decide el frontend, no este endpoint. |

## Años disponibles para el selector (research.md § 4)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/reportes/anual/anios-disponibles` | Devuelve `{ anioMin: number \| null }` — el año de la factura no eliminada más antigua, o `null` si el usuario no tiene ninguna factura capturada todavía. No incluye un `anioMax`: el tope superior del selector es siempre el año en curso, que el frontend ya calcula localmente para el default de FR-001 — devolverlo también desde el backend solo arriesgaría una desincronización servidor/cliente sin aportar nada que el cliente no supiera ya. |

## Exportar el reporte de un año (US2)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/reportes/anual/exportar?anio=YYYY&formato=xlsx\|pdf` | Genera y descarga el archivo (FR-010): resumen agregado (igual que `GET /reportes/anual`) + una fila por factura elegible del año (`FilaExportacion`, data-model.md) + la nota del Principio IV. `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (xlsx) o `application/pdf`, con `Content-Disposition: attachment; filename="reporte-renta-{anio}.{ext}"`. `400` si `anio` falta/inválido o `formato` no es exactamente `xlsx` o `pdf` — sin formato por defecto implícito (spec.md: "el usuario elige cuál de los dos formatos quiere en cada exportación"). |

## Comportamiento modificado en endpoints existentes

- `GET /invoices` (feature 001, extendido por feature 003): `FiltrosFactura` gana un campo opcional nuevo `moneda` (p. ej. `moneda=COP`). Omitirlo preserva exactamente el comportamiento actual (todas las monedas) — el único consumidor nuevo de este filtro es el enlace "ver en el Listado" que construye el reporte (FR-005), para que la vista filtrada reconcilie exactamente con el total y conteo del reporte (data-model.md § Decisión de diseño, SC-004).
