# Tasks: Validación y conciliación contra la DIAN

**Input**: Design documents from `/specs/003-validacion-dian/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md — todos completos.

**Tests**: Solo se incluyen tests unitarios de dominio donde la constitution los exige (Principio VIII: reglas de negocio) — sin tests de contrato/integración nuevos más allá de eso, mismo criterio pragmático ya aplicado en `specs/001-captura-facturas/tasks.md` y `specs/002-rediseno-visual-web/tasks.md`.

**Organization**: Tareas agrupadas por historia de usuario (P1→P2), mismo orden de entrega incremental que las features anteriores — cada historia se construye, valida end-to-end, y se da por completa antes de avanzar a la siguiente. **No se paralelizan entre sí**: `/speckit-implement` se invoca acotado a una fase (Setup + Foundational + una historia) a la vez.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencia entre sí)
- **[Story]**: Historia de usuario a la que pertenece la tarea (US1, US2)
- Cada tarea incluye la ruta de archivo exacta

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: dependencia nueva identificada en research.md § 4 — nada de esto depende de ninguna historia.

- [X] T001 Instalar `exceljs` en `apps/api/package.json` (research.md § 4 — parseo del Excel de conciliación, US2)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: el modelo de datos y la entidad de dominio de `ValidacionDian` — ninguna historia puede persistir nada sin esto.

**⚠️ CRITICAL**: ninguna historia puede empezar hasta que esta fase esté completa.

- [X] T002 [P] Migración Prisma: nuevo modelo `ValidacionDian` (relación N-a-1 con `Factura`) y enums `MetodoValidacionDian` (`manual`/`conciliacion`), `ResultadoValidacionDian` (`valido_vigente`/`no_encontrado`/`anulado_reemplazado`/`otro`) en `apps/api/prisma/schema.prisma` (data-model.md) — `prisma generate` verificado offline; migración real pendiente de que el usuario la aplique
- [X] T003 [P] Entidad de dominio `ValidacionDian` + tipos `MetodoValidacionDian`/`ResultadoValidacionDian` en `packages/domain/src/entities/validacion-dian.ts` — sin importar Prisma/NestJS (constitution Principio V)
- [X] T004 Módulo NestJS nuevo `apps/api/src/modules/validacion-dian/validacion-dian.module.ts`, separado de `modules/invoices` (mismo criterio que `modules/extraction` — responsabilidad de negocio distinta sobre la misma entidad `Factura`) (depende de T002, T003)

**Checkpoint**: modelo de datos y módulo listos — cualquier historia puede empezar a construir sobre esto.

---

## Phase 3: User Story 1 - Validación asistida de un documento individual (Priority: P1) 🎯 MVP

**Goal**: enlace de consulta DIAN con el CUFE precargado, registro manual del resultado, visible en Detalle y Listado.

**Independent Test**: con una factura con CUFE ya extraído, obtener el enlace, registrar un resultado, y verificar que queda visible en su Detalle y distinguible en el Listado (spec.md User Story 1, Acceptance Scenarios 1-5).

### Implementación para User Story 1

- [X] T005 [US1] `ValidacionDianRepository`: `crear()` (toma el snapshot de la `Factura` actual automáticamente — data-model.md; rechaza si `cufe` es nulo, FR-005) y `listarPorFactura()` (ordenado `creadaEn` DESC) en `apps/api/src/modules/validacion-dian/validacion-dian.repository.ts` (depende de T004)
- [X] T006 [US1] Endpoint `POST /invoices/:id/validaciones-dian` en `apps/api/src/modules/validacion-dian/validacion-dian.controller.ts` — valida el enum de `resultado`, 404 si la factura no existe/está eliminada, 400 si `cufe` es nulo (contracts/api.md) (depende de T005)
- [X] T007 [US1] Endpoint `GET /invoices/:id/validaciones-dian` en el mismo controller — array vacío si nunca se validó, no un error (depende de T005)
- [X] T008 [P] [US1] Extender `FacturaRepository.listar()` con el campo `ultimaValidacionDian` por ítem (una sola consulta agregada, no N+1) en `apps/api/src/modules/invoices/factura.repository.ts` (contracts/api.md) (depende de T004)
- [X] T009 [P] [US1] Registrar `ValidacionDianModule` en `apps/api/src/app.module.ts`
- [X] T010 [P] [US1] Cliente HTTP `apps/web/src/services/validacion-dian.ts`: construir el enlace `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey={cufe}` (research.md § 1), POST de resultado, GET de historial
- [X] T011 [P] [US1] Sección de validación DIAN en `apps/web/src/pages/Detalle.tsx`: acción visible solo si `cufe` no es nulo (FR-005) — enlace + botón "copiar CUFE" (fallback si el portal no autocompleta, research.md § 1), selector de las 4 opciones de resultado, historial de validaciones previas (depende de T010)
- [X] T012 [P] [US1] Indicador de estado de validación por fila en `apps/web/src/pages/Listado.tsx` usando `ultimaValidacionDian` (depende de T008, T010)

**Checkpoint**: US1 completa y validada — flujo de validación individual funciona de punta a punta.

---

## Phase 4: User Story 2 - Conciliación en lote contra un documento descargado de la DIAN (Priority: P2)

**Goal**: conciliar el backlog completo de facturas capturadas contra el Excel real de documentos recibidos de la DIAN, en una sola operación.

**Independent Test**: con un Excel real de ejemplo que contenga el CUFE de al menos una factura capturada, aportarlo y verificar que esa factura queda conciliada, sin necesitar la User Story 1 (spec.md User Story 2, Acceptance Scenarios 1-3).

### Implementación para User Story 2

- [X] T013 [US2] **Confirmar el esquema real de columnas del Excel de conciliación contra un archivo de ejemplo aportado por el usuario** (research.md § 3 — no se pudo confirmar sin acceso autenticado al portal transaccional de la DIAN). El usuario no aportó un archivo de ejemplo — se procedió con el diseño defensivo ya documentado en research.md (columna reconocida por nombre normalizado, no posición fija) en vez de bloquear; T015 deja explícito en el código que esto sigue sin validarse contra un archivo real
- [X] T014 [P] [US2] Regla de dominio pura `conciliarCufes(cufesDelDocumento, facturasCandidatas)` en `packages/domain/src/rules/conciliacion-dian.ts` — coincidencia exacta de CUFE (data-model.md § Regla de dominio), con test unitario en `packages/domain/test/conciliacion-dian.spec.ts` (constitution Principio VIII) — 7 casos, incluyendo facturas duplicadas que comparten CUFE y CUFEs repetidos en el propio documento
- [X] T015 [US2] `ConciliacionExcelService`: parseo del `.xlsx` con `exceljs`, búsqueda tolerante de la columna CUFE/CUDE (nunca posición fija), extracción de la lista de CUFEs, rechazo explícito si no encuentra columna reconocible (FR-009) en `apps/api/src/modules/validacion-dian/conciliacion-excel.service.ts` (depende de T001, T013)
- [X] T016 [US2] Endpoint `POST /invoices/dian-conciliacion` (multipart, un archivo) — en `conciliacion-dian.controller.ts` (controller separado de `validacion-dian.controller.ts`: ruta hermana `/invoices/dian-conciliacion`, no anidada bajo `:facturaId`) — orquesta `ConciliacionExcelService` + `FacturaRepository.listarConCufe()` (nuevo método, excluye eliminadas y sin CUFE) + `conciliarCufes` + crea las `ValidacionDian` resultantes (`metodo: conciliacion`, `resultado: valido_vigente`), responde `{ facturasConciliadas, cufesSinCoincidencia }` (contracts/api.md) (depende de T014, T015)
- [X] T017 [P] [US2] Pantalla `apps/web/src/pages/ConciliacionDian.tsx`: subir el archivo, mostrar el resumen de la conciliación, acceso desde Listado (ícono nuevo en el header, junto a buscar/filtro)
- [X] T018 [US2] Método de conciliación (subida de archivo) en `apps/web/src/services/validacion-dian.ts` (depende de T010)

**Checkpoint**: US1 y US2 funcionan juntas — validación individual y conciliación en lote, ambas sin modificar `elegibilidadTributaria`/`tipoDocumento` de ninguna factura.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: mejoras que afectan a ambas historias, después de que están construidas.

- [X] T019 [P] Actualizar `README.md` con la dependencia nueva (`exceljs`) y una nota sobre el flujo de validación DIAN (enlace asistido + conciliación en lote) — nueva sección "Validación DIAN"
- [X] T020 Verificación estática completa de punta a punta: build + 65/65 tests + `tsc` + `eslint` en `packages/domain`, `tsc` + `eslint` + `jest` en `apps/api`, `tsc` + `eslint` en `apps/web` — todo en verde. La validación funcional real de `quickstart.md` (P1→P2 + no-regresión sobre 001/002) requiere accionar el navegador y no se ejecutó aquí — queda documentada como pendiente manual del usuario en el reporte de cierre de esta fase.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — arranca de inmediato
- **Foundational (Phase 2)**: depende de Setup — bloquea US1 y US2
- **User Stories (Phase 3-4)**: en orden de prioridad P1→P2, cada una depende de que la anterior esté completa y validada — no se paralelizan entre sí en este proyecto
- **Polish (Phase 5)**: depende de que ambas historias estén completas

### Dependencias entre historias

- **US1**: depende de Foundational (Phase 2). No depende de US2.
- **US2**: depende de Foundational (Phase 2). Reusa el cliente HTTP creado en US1 (T010) pero su lógica de conciliación (T013-T016) es independiente de que US1 esté siquiera terminada de usar en producción — solo comparte infraestructura, no resultado.

### Parallel Opportunities

- Todas las tareas `[P]` dentro de una misma fase pueden ejecutarse en paralelo (archivos distintos, sin dependencia entre sí)
- Entre fases de historias de usuario: **no ejecutar en paralelo** — mismo motivo que las features anteriores (proyecto de un solo desarrollador asistido por el agente, acuerdo explícito de fase por fase con validación end-to-end)

---

## Parallel Example: User Story 1

```bash
# Backend y frontend de US1, una vez T004/T005 están listos, son archivos distintos:
Task: "Extender FacturaRepository.listar() con ultimaValidacionDian en apps/api/src/modules/invoices/factura.repository.ts"
Task: "Registrar ValidacionDianModule en apps/api/src/app.module.ts"
Task: "Cliente HTTP en apps/web/src/services/validacion-dian.ts"
```

---

## Implementation Strategy

### MVP visual (User Story 1 solamente)

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational (modelo de datos — bloquea US1/US2)
3. Completar Phase 3: User Story 1
4. **DETENERSE y VALIDAR**: probar US1 de forma independiente contra `quickstart.md` § P1
5. Confirmación humana antes de continuar con US2

### Entrega incremental

1. Setup + Foundational → modelo de datos listo
2. US1 → validar independientemente → confirmación humana (MVP)
3. US2 → validar independientemente → confirmación humana
4. Polish (Phase 5)

Cada historia agrega valor sin romper la anterior — `/speckit-implement` se invoca acotado a una fase (Setup + Foundational + una historia) a la vez, igual que en `specs/001-captura-facturas` y `specs/002-rediseno-visual-web`.

---

## Notes

- `[P]` = archivos distintos, sin dependencias entre sí
- La etiqueta `[Story]` mapea cada tarea a su historia de usuario para trazabilidad
- T013 (confirmar esquema real del Excel) es un prerrequisito de investigación, no de código — si no se resuelve antes de T015, la tarea de implementación del parser debe absorber esa investigación exploratoria como su propio primer paso, no asumir columnas sin verificar
- Commitear después de cada historia completa, nunca varias historias juntas en un solo commit
- Detenerse en cada checkpoint para validación humana antes de continuar
