# Tasks: Reporte anual de compras elegibles para renta

**Input**: Design documents from `/specs/004-reporte-anual-renta/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md — todos completos.

**Tests**: Solo se incluyen tests unitarios de dominio donde la constitution los exige (Principio VIII: reglas de negocio) — sin tests de contrato/integración nuevos más allá de eso, mismo criterio pragmático ya aplicado en `specs/001-captura-facturas/tasks.md`, `specs/002-rediseno-visual-web/tasks.md` y `specs/003-validacion-dian/tasks.md`.

**Organization**: Tareas agrupadas por historia de usuario (P1→P2), mismo orden de entrega incremental que las features anteriores — cada historia se construye, valida end-to-end, y se da por completa antes de avanzar a la siguiente. **No se paralelizan entre sí**: `/speckit-implement` se invoca acotado a una fase (Setup + Foundational + una historia) a la vez.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin colisión con otras tareas de la misma fase)
- **[Story]**: Historia de usuario a la que pertenece la tarea (US1, US2)
- Cada tarea incluye la ruta de archivo exacta

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: dependencia nueva identificada en research.md § 1 — nada de esto depende de ninguna historia.

- [X] T001 Instalar `pdfmake` (+ `@types/pdfmake`) en `apps/api/package.json` (research.md § 1 — generación de PDF, US2). `exceljs` ya está instalado desde la feature 003, no requiere reinstalación.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: el cálculo del reporte (regla de dominio + orquestación) que tanto la pantalla (US1) como la exportación (US2) consumen — ninguna historia puede mostrar ni exportar nada sin esto.

**⚠️ CRITICAL**: ninguna historia puede empezar hasta que esta fase esté completa.

- [X] T002 [P] Regla de dominio pura `calcularReporteAnual(anio, facturas)` en `packages/domain/src/rules/reporte-anual.ts` — recibe una forma mínima `{ fechaHoraCompra, totalCentavos, moneda }[]`, filtra internamente a `moneda === 'COP'` para `totalCentavos`/`conteo`/`desglosePorMes` (data-model.md § Validaciones de dominio — FR-003 liga "cuántas facturas" a "ese total"), siempre devuelve los 12 meses del año incluidos los de $0 (FR-004). Test unitario en `packages/domain/test/reporte-anual.spec.ts` (constitution Principio VIII) cubriendo: meses sin facturas en $0, exclusión de monedas distintas a COP del total/conteo/desglose, y que la suma de `desglosePorMes` cuadra exactamente con `totalCentavos`/`conteo`. 5 tests, todos en verde.
- [X] T003 [P] Extender `FiltrosFactura` con campo opcional `moneda` en `apps/api/src/modules/invoices/dto/filtrar-facturas.dto.ts` y aplicarlo en `FacturaRepository.listar()` en `apps/api/src/modules/invoices/factura.repository.ts` (data-model.md § Decisión de diseño — reconciliación con el Listado, contracts/api.md). Omitir el filtro preserva exactamente el comportamiento actual (todas las monedas).
- [X] T004 Módulo NestJS nuevo `apps/api/src/modules/reportes/reportes.module.ts`, importa `InvoicesModule` (para `FacturaRepository`, mismo patrón que `modules/validacion-dian`) (depende de T002, T003)
- [X] T005 `ReporteAnualService` en `apps/api/src/modules/reportes/reporte-anual.service.ts`: obtiene las facturas elegibles del año vía `FacturaRepository.listar({ fechaDesde: 1-ene-anio, fechaHasta: 31-dic-anio, elegibilidad: true })` **sin** filtro de moneda (trae todas las elegibles del año, cualquier moneda), aplica `calcularReporteAnual` (T002) sobre esos resultados para obtener el resumen COP-only, y expone también la lista completa sin filtrar — la usará US2 para construir `FilaExportacion` (data-model.md, incluye monedas distintas a COP) (depende de T002, T004)

**Checkpoint**: cálculo del reporte listo — ambas historias pueden construirse sobre esto.

---

## Phase 3: User Story 1 - Reporte anual consultable en la app (Priority: P1) 🎯 MVP

**Goal**: pantalla con selector de año (año en curso por defecto), resumen (total COP + conteo), desglose de 12 meses, enlace al Listado filtrado a esas mismas facturas, y la nota constitucional siempre visible.

**Independent Test**: con un backlog de facturas elegibles capturadas en distintos meses de un mismo año, abrir el reporte, elegir ese año, y verificar que el total, el conteo, y el desglose mensual coinciden con la suma real de esas facturas — y que desde ahí se llega al listado filtrado de las mismas (spec.md User Story 1, Acceptance Scenarios 1-7).

### Implementación para User Story 1

- [X] T006 [P] [US1] Método `obtenerAnioMasAntiguo()` en `apps/api/src/modules/invoices/factura.repository.ts`: consulta agregada `min` de `fechaHoraCompra` sobre facturas no eliminadas; `null` si no hay ninguna (research.md § 4, contracts/api.md)
- [X] T007 [US1] Endpoint `GET /reportes/anual?anio=` en `apps/api/src/modules/reportes/reportes.controller.ts` — `400` si `anio` falta o no es un entero válido; nunca `404`, un año sin datos responde `200` en ceros (contracts/api.md, Acceptance Scenario 7) (depende de T005)
- [X] T008 [US1] Endpoint `GET /reportes/anual/anios-disponibles` en el mismo controller — `{ anioMin: number | null }`, sin `anioMax` (el frontend usa el año en curso local, contracts/api.md) (depende de T006; mismo archivo que T007, no paralelizable con ella)
- [X] T009 [P] [US1] Registrar `ReportesModule` en `apps/api/src/app.module.ts` (depende de T004)
- [X] T010 [P] [US1] Cliente HTTP `apps/web/src/services/reportes.ts`: consultar reporte por año, consultar años disponibles
- [X] T011 [P] [US1] Pantalla `apps/web/src/pages/ReporteAnual.tsx`: selector de año (poblado con `anios-disponibles`, año en curso por defecto — FR-001), resumen (total COP + conteo), desglose de los 12 meses (siempre completos, FR-004), botón "ver en Listado" (resumen del Principio IV, FR-007). **Desviación del plan**: esta SPA no tiene enrutamiento por URL (`App.tsx` usa un `Vista` de estado en memoria, sin `react-router` ni querystring) — "abrir el listado filtrado" (FR-005) se implementó como un callback `onAbrirListado(filtros)` que hace transicionar `Vista` a `{ tipo: 'listado', filtrosIniciales }`, con `Listado.tsx` extendido para aceptar una semilla de filtros (`filtrosIniciales?`) en vez de arrancar siempre en `FILTROS_VACIOS`. El resultado (Listado abre ya filtrado por `fechaDesde`/`fechaHasta`/`elegibilidad=true`/`moneda=COP`) es el mismo que describía contracts/api.md, solo el mecanismo cambió. El indicador de validación DIAN por factura ya existe en esa vista del Listado desde la feature 003 — FR-006 se satisface reusándolo, sin duplicar esa UI en el reporte (depende de T010)
- [X] T012 [P] [US1] Acceso a la pantalla del reporte desde la navegación existente de la app: ícono nuevo (`reporte` — `ChartColumn`/`ChartBarIcon`) en el header de `Listado.tsx`, junto al de conciliación DIAN

**Checkpoint**: US1 completa y validada — el reporte en pantalla responde de punta a punta la pregunta "¿cuánto llevo este año?" sin cálculo manual.

---

## Phase 4: User Story 2 - Exportar el reporte fuera de la app (Priority: P2)

**Goal**: exportar el reporte de un año a Excel o PDF (el usuario elige el formato en cada exportación), con el resumen agregado y una fila por cada factura elegible del año — en cualquier moneda, no solo COP (data-model.md § FilaExportacion) — para que sirva como soporte real ante un contador.

**Independent Test**: con el reporte de un año ya construido en pantalla (User Story 1), exportarlo y verificar que el archivo resultante contiene el mismo total, conteo, y desglose que se veía en la app, más una fila por factura elegible (spec.md User Story 2, Acceptance Scenarios 1-2).

### Implementación para User Story 2

- [X] T013 [P] [US2] `ReporteExcelService` en `apps/api/src/modules/reportes/reporte-excel.service.ts`: arma el `.xlsx` con `exceljs` — resumen (total, conteo, desglose de 12 meses) + una fila por `FilaExportacion` (comercio, fecha, monto, **moneda**, tipo de documento, si ya tiene validación DIAN — cualquier moneda, no solo COP) + la nota del Principio IV (depende de T005)
- [X] T014 [P] [US2] `ReportePdfService` en `apps/api/src/modules/reportes/reporte-pdf.service.ts`: arma el `.pdf` con `pdfmake` — mismo contenido que T013 (resumen + tabla de filas con columna de moneda + nota) (depende de T001, T005). Usa la fuente estándar PDF `Helvetica` (una de las 14 fuentes base del formato, sin embeber ningún `.ttf` — soporta tildes/ñ vía WinAnsiEncoding), verificado leyendo el código fuente y los tipos reales de `pdfmake@0.3.11`/`@types/pdfmake@0.3.3` instalados (la API Node difiere de la de versiones antiguas basadas en `PdfPrinter`).
- [X] T015 [US2] Endpoint `GET /reportes/anual/exportar?anio=&formato=xlsx|pdf` en `reportes.controller.ts` — `400` si `anio`/`formato` faltan o `formato` no es exactamente `xlsx`/`pdf` (sin default implícito, spec.md: "el usuario elige cuál"); responde con el `Content-Type` y `Content-Disposition: attachment; filename="reporte-renta-{anio}.{ext}"` correctos por formato (contracts/api.md) (depende de T013, T014; mismo archivo que T007/T008, no paralelizable con ellas)
- [X] T016 [P] [US2] Selector "Exportar" (Excel / PDF) en `apps/web/src/pages/ReporteAnual.tsx`, dispara la descarga del endpoint T015 (depende de T011)
- [X] T017 [P] [US2] Método de exportación (descarga de archivo, vía blob + enlace temporal) en `apps/web/src/services/reportes.ts` (depende de T010)

**Checkpoint**: US1 y US2 funcionan juntas — reporte en pantalla y exportación en dos formatos, ninguna de las dos modifica `elegibilidadTributaria`/`tipoDocumento` de ninguna factura.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: mejoras que afectan a ambas historias, después de que están construidas.

- [X] T018 [P] Actualizar `README.md` con la dependencia nueva (`pdfmake`) y una nota sobre el reporte anual (consulta por año, desglose mensual, exportación a Excel/PDF) — nueva sección "Reporte anual", mismo estilo que las secciones ya agregadas para 002/003
- [X] T019 Verificación estática completa de punta a punta: build + tests de dominio (incluye `reporte-anual.spec.ts`) + `tsc` + `eslint` en `packages/domain`, `tsc` + `eslint` + `jest` en `apps/api`, `tsc` + `eslint` en `apps/web` — todo en verde. La validación funcional real (US1+US2 de `quickstart.md`) sí se hizo end-to-end contra la app corriendo (el usuario la probó en vivo), y de ahí salieron 3 fixes reales no anticipados en el plan original: la tarjeta "Compras elegibles"/"Total facturas" del Listado no reflejaba el filtro de elegibilidad activo (bug pre-existente de la feature 001, expuesto por la comparación directa con este reporte nuevo), y el flujo de filtros del Listado pasó de botón "Aplicar" a auto-aplicar con debounce + `AbortController` (verificado contra `modern-web-guidance` que ese patrón sigue vigente). Detalle en `apps/web/src/pages/Listado.tsx`. No-regresión sobre 001/002/003 no se re-probó exhaustivamente más allá de lo que este flujo ya ejercitó.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — arranca de inmediato
- **Foundational (Phase 2)**: depende de Setup — bloquea US1 y US2
- **User Stories (Phase 3-4)**: en orden de prioridad P1→P2, cada una depende de que la anterior esté completa y validada — no se paralelizan entre sí en este proyecto
- **Polish (Phase 5)**: depende de que ambas historias estén completas

### Dependencias entre historias

- **US1**: depende de Foundational (Phase 2). No depende de US2.
- **US2**: depende de Foundational (Phase 2). Reusa el cliente HTTP y la pantalla creados en US1 (T010, T011) pero su lógica de exportación (T013-T015) es independiente de que US1 esté siquiera terminada de usar en producción — solo comparte infraestructura, no resultado.

### Parallel Opportunities

- Todas las tareas `[P]` dentro de una misma fase pueden ejecutarse en paralelo (archivos distintos, sin colisión entre sí)
- Entre fases de historias de usuario: **no ejecutar en paralelo** — mismo motivo que las features anteriores (proyecto de un solo desarrollador asistido por el agente, acuerdo explícito de fase por fase con validación end-to-end)

---

## Parallel Example: User Story 1

```bash
# Una vez T005 (Foundational) está listo, son archivos distintos:
Task: "Método obtenerRangoAnios() en apps/api/src/modules/invoices/factura.repository.ts"
Task: "Registrar ReportesModule en apps/api/src/app.module.ts"
Task: "Cliente HTTP en apps/web/src/services/reportes.ts"
```

---

## Implementation Strategy

### MVP visual (User Story 1 solamente)

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational (cálculo del reporte — bloquea US1/US2)
3. Completar Phase 3: User Story 1
4. **DETENERSE y VALIDAR**: probar US1 de forma independiente contra `quickstart.md` § P1
5. Confirmación humana antes de continuar con US2

### Entrega incremental

1. Setup + Foundational → cálculo del reporte listo
2. US1 → validar independientemente → confirmación humana (MVP)
3. US2 → validar independientemente → confirmación humana
4. Polish (Phase 5)

Cada historia agrega valor sin romper la anterior — `/speckit-implement` se invoca acotado a una fase (Setup + Foundational + una historia) a la vez, igual que en `specs/001-captura-facturas`, `specs/002-rediseno-visual-web` y `specs/003-validacion-dian`.

---

## Notes

- `[P]` = archivos distintos, sin colisión con otras tareas de la misma fase (algunas tareas `[P]` dependen igual de una tarea anterior — la dependencia se anota entre paréntesis; `[P]` describe ausencia de conflicto de archivo, no ausencia total de orden)
- La etiqueta `[Story]` mapea cada tarea a su historia de usuario para trazabilidad
- `FilaExportacion` (US2) incluye facturas elegibles en **cualquier moneda** — a diferencia del resumen/desglose (COP-only, FR-009), FR-010 no lleva ese calificador; no omitir la columna `moneda` en el archivo exportado (T013/T014) para que una fila en moneda extranjera nunca se lea como si fuera COP
- Commitear después de cada historia completa, nunca varias historias juntas en un solo commit
- Detenerse en cada checkpoint para validación humana antes de continuar
