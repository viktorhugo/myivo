# Quickstart: Validación end-to-end por historia de usuario

Guía de validación manual, no de implementación. Prerrequisitos comunes: ver `specs/001-captura-facturas/quickstart.md` (sesión autenticada, `docker compose up`). Además, para que el reporte muestre algo distinto de ceros: al menos dos facturas ya capturadas y marcadas como elegibles (feature 001) en meses distintos de un mismo año, y opcionalmente una factura elegible en una moneda distinta a COP (para validar FR-009).

## P1 — Reporte anual consultable en la app

**Objetivo**: demostrar que el reporte responde exactamente la pregunta que el MVP original dejó abierta, sin cálculo manual, y que reconcilia con el Listado.

1. Abrir el reporte por primera vez — confirmar que el año seleccionado por defecto es el año en curso (Acceptance Scenario 1, FR-001).
2. Con facturas elegibles capturadas en un año anterior, cambiar el selector a ese año — confirmar que el total, conteo, y desglose mensual se recalculan (Acceptance Scenario 2).
3. Confirmar que el desglose muestra los 12 meses, incluidos los que no tienen ninguna compra elegible, en $0 — no una lista más corta (Acceptance Scenario 3, FR-004).
4. Desde el reporte, abrir el listado de las facturas que lo componen — confirmar que llega al Listado ya filtrado (mismo año, elegibles, sin tener que reconstruir el filtro a mano) y que el total/conteo mostrado ahí coincide exactamente con el del reporte (Acceptance Scenario 4, FR-005, SC-004).
5. Confirmar que la nota de "información organizada, no un concepto tributario, revisar con un contador" está siempre visible en el reporte (Acceptance Scenario 5, FR-007, constitution Principio IV).
6. Sobre una factura del reporte que ya tiene una validación DIAN registrada (feature 003) y otra que no, confirmar que el reporte distingue una de otra (Acceptance Scenario 6, FR-006) — sin que eso cambie si la factura aparece o no en el reporte.
7. Elegir un año sin ninguna compra elegible (o un año futuro) — confirmar `$0` y `0` facturas, mostrado como un estado normal, no un error (Acceptance Scenario 7, Edge Case "año futuro").
8. Si hay una factura elegible en moneda distinta a COP: confirmar que queda fuera del total, el conteo, y el desglose del reporte (FR-009, Edge Case de moneda).

```bash
curl -b cookies.txt "https://localhost/reportes/anual?anio=2026"
curl -b cookies.txt "https://localhost/reportes/anual/anios-disponibles"
```

**Resultado esperado**: `200` con `{ anio, totalCentavos, conteo, desglosePorMes }` (contracts/api.md) — `totalCentavos` y `conteo` deben coincidir exactamente con sumar a mano el `desglosePorMes` devuelto.

## P2 — Exportar el reporte

**Objetivo**: demostrar que el archivo exportado sirve como soporte real ante un tercero, con el mismo contenido que la pantalla.

1. Con el reporte de un año con datos en pantalla, exportarlo eligiendo Excel — confirmar que el archivo descargado contiene el resumen agregado y una fila por cada factura elegible del año (comercio, fecha, monto, tipo de documento, si ya tiene validación DIAN) — Acceptance Scenario 1, FR-010.
2. Repetir eligiendo PDF — mismo contenido, formato distinto.
3. Abrir el archivo exportado (cualquiera de los dos formatos) y confirmar que incluye la misma nota del Principio IV que la pantalla (Acceptance Scenario 2, FR-007).

```bash
curl -b cookies.txt "https://localhost/reportes/anual/exportar?anio=2026&formato=xlsx" -o reporte-2026.xlsx
curl -b cookies.txt "https://localhost/reportes/anual/exportar?anio=2026&formato=pdf" -o reporte-2026.pdf
```

**Resultado esperado**: descarga binaria en ambos casos, con `Content-Disposition: attachment`. El total/conteo dentro del archivo debe coincidir exactamente con lo que mostraba la pantalla en el paso previo (misma fuente de datos, misma consulta).

**Validar el caso sin formato**: pedir la exportación sin `formato` o con un valor distinto a `xlsx`/`pdf` — confirmar `400`, no una descarga vacía o un formato por defecto silencioso (contracts/api.md).

## Validar que nada se rompió

Repetir los escenarios de aceptación de `specs/001-captura-facturas/quickstart.md`, `specs/002-rediseno-visual-web/quickstart.md`, y `specs/003-validacion-dian/quickstart.md` — clasificación, elegibilidad, duplicados, filtros, temas visuales, y validación DIAN deben comportarse exactamente igual que antes de esta feature. En particular:

- Confirmar que `GET /invoices` sin el nuevo parámetro `moneda` sigue devolviendo exactamente lo mismo que antes (contracts/api.md § Comportamiento modificado).
- Confirmar que abrir el reporte o exportarlo no modifica ninguna `Factura` (`elegibilidadTributaria`, `tipoDocumento` sin cambios) — es una vista de solo lectura (data-model.md § Validaciones de dominio, constitution Principio IV).
