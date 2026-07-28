# Tasks: Rediseño visual — temas Industry/Nocturne

**Input**: Design documents from `/specs/002-rediseno-visual-web/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md — todos completos.

**Tests**: Solo se incluyen tests unitarios de dominio donde la constitution los exige (Principio VIII: máquina de estados, reglas de negocio) — sin tests de contrato/integración nuevos más allá de eso, siguiendo el mismo criterio pragmático ya aplicado en `specs/001-captura-facturas/tasks.md`.

**Organization**: Tareas agrupadas por historia de usuario (P1→P5), en el mismo orden de entrega incremental de la feature 001 — cada historia se construye, valida end-to-end, y se da por completa antes de avanzar a la siguiente. **No se paralelizan entre sí** (mismo acuerdo que 001): `/speckit-implement` se invoca acotado a una fase (Setup + Foundational + una historia) a la vez.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencia entre sí)
- **[Story]**: Historia de usuario a la que pertenece la tarea (US1-US5)
- Cada tarea incluye la ruta de archivo exacta

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: preparar los assets estáticos que todas las historias visuales van a consumir — nada de esto depende de ninguna historia.

- [X] T001 [P] Instalar paquetes de iconos (`lucide-react` para Industry, un paquete de iconos Phosphor para Nocturne) en `apps/web/package.json`
- [X] T002 [P] Descargar y colocar los archivos `.woff2` de Barlow, Barlow Condensed e Inter (con su licencia OFL) en `apps/web/src/theme/fonts/` — research.md § 1 (auto-hospedar, nunca CDN externo)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: infraestructura de temas compartida por todas las pantallas — el punto único donde se define el `data-theme` de la raíz y las variables CSS de ambos temas completos.

**⚠️ CRITICAL**: ninguna historia visual (US1, US4, US5) puede empezar hasta que esta fase esté completa. US2 y US3 (backend puro + un botón simple) no dependen de esta fase, pero se construyen después por orden de prioridad, no en paralelo.

- [X] T003 Crear `apps/web/src/theme/tokens.css` con las variables CSS completas de ambos temas (`[data-theme="industry"]` / `[data-theme="nocturne"]`) — colores, tipografía, radios, tal como research.md § 2 y el README de diseño los especifican, incluyendo los `@font-face` de las fuentes de T002
- [X] T004 Crear `apps/web/src/theme/useTheme.ts` — hook que lee/persiste la preferencia en `localStorage` (`industry` \| `nocturne` \| `system`), resuelve `system` vía `matchMedia('(prefers-color-scheme: dark)')`, y aplica el atributo `data-theme` en `<html>` antes del primer render visible (research.md § 3, FR-002/FR-003)
- [X] T005 Integrar `useTheme` en `apps/web/src/App.tsx` + selector de tema visible desde cualquier pantalla (depende de T003, T004)

**Checkpoint**: sistema de temas funcionando de punta a punta — cambiar el selector cambia toda la app de inmediato. Cualquier historia puede empezar a consumir los tokens.

---

## Phase 3: User Story 1 - Sistema de diseño visual con dos temas (Priority: P1) 🎯 MVP visual

**Goal**: las 3 pantallas principales (Captura, Detalle, Listado) se ven y sienten como el diseño de referencia, en ambos temas, sin alterar ninguna funcionalidad ya implementada.

**Independent Test**: navegar Captura → Listado → Detalle con cada tema activo y confirmar contra el diseño de referencia (spec.md User Story 1, Acceptance Scenarios 1-6); repetir los escenarios de H2-H5 de `specs/001-captura-facturas/quickstart.md` sin cambios de resultado.

### Implementación para User Story 1

- [X] T006 [P] [US1] Refactorizar `apps/web/src/pages/Captura.tsx`: migrar estilos inline a los tokens de `tokens.css`, iconografía por estado (recibida/procesando/extraída/necesita_revisión/fallida — el 6to estado "varias facturas" se agrega en US3), FAB de cámara, copy tal como especifica el diseño
- [X] T007 [P] [US1] Refactorizar `apps/web/src/pages/Detalle.tsx`: migrar a tokens, foto colapsable, puntos de confianza por campo con leyenda, banner de elegibilidad, badge "Corregido" + valor original tachado, grid de campos (FR-005/FR-006)
- [X] T008 [P] [US1] Refactorizar `apps/web/src/pages/Listado.tsx`: migrar a tokens, chips de filtro, bloque de total agregado, agrupación por mes, badge de moneda distinta a COP + etiqueta "Fuera del total en COP" (FR-007)
- [X] T009 [US1] Validar manualmente contra `specs/001-captura-facturas/quickstart.md` (H2-H5) que ninguna funcionalidad existente (clasificación, elegibilidad, duplicados, filtros) cambió de comportamiento (SC-004) — depende de T006, T007, T008

### Extensión de User Story 1 — descubrimientos de la validación en navegador

Hallazgos que solo aparecieron al usar la app en un navegador real (ninguno era detectable compilando ni con scripts HTTP):

- [X] T009a [US1] Proxy `/api` → backend en `apps/web/vite.config.ts`: sin él el dev server devolvía su propio `index.html` a cada llamada de API ("Unexpected token '<'"). En producción lo resuelve Caddy, pero en desarrollo no existía.
- [X] T009b [US1] Pantalla de inicio de sesión (`apps/web/src/pages/Login.tsx` + `apps/web/src/services/auth.ts`): el backend siempre exigió sesión (FR-030) pero el frontend nunca tuvo forma de autenticarse — todo el testing previo se hizo con scripts HTTP. Sin esto la app era inusable desde el navegador.
- [X] T009c [US1] Rendición JPEG para navegador (`apps/api/src/modules/invoices/imagen-web.service.ts`, `GET /invoices/:id/image?variant=web`): las fotos de iPhone se guardan en HEIC y ningún navegador las renderiza, así que la "foto colapsable" de esta historia nunca podía mostrarse. El derivado se genera bajo demanda, se guarda como archivo nuevo y se registra en `Factura.derivados`; el original queda intacto (constitution Principio I). Verificado: JPEG 1600px real, servido desde caché en ~20ms tras la primera generación.

**Checkpoint**: US1 completa y validada — la app se ve y siente como el diseño de referencia en las 3 pantallas principales, con ambos temas, sin romper nada existente.

---

## Phase 4: User Story 2 - Eliminar factura (soft-delete) (Priority: P2)

**Goal**: el usuario puede eliminar (soft-delete) una factura desde Detalle, sin riesgo de purga automática ni de pérdida del archivo original.

**Independent Test**: eliminar una factura vía `POST /invoices/:id/delete`, confirmar `404` en `GET /invoices/:id` y ausencia en el listado, y confirmar directamente en la base de datos/almacenamiento que el registro y la imagen siguen existiendo (spec.md User Story 2, Acceptance Scenarios 1-3).

### Implementación para User Story 2

- [X] T010 [P] [US2] Migración Prisma: agregar columna `eliminadaEn` (timestamp, nullable) a `Factura` en `apps/api/prisma/schema.prisma`
- [X] T011 [P] [US2] Agregar campo `eliminadaEn: Date | null` a la entidad `Factura` en `packages/domain/src/entities/factura.ts`
- [X] T012 [US2] Excluir registros con `eliminadaEn` no nulo en `FacturaRepository.obtenerPorId()` y `.listar()` (incluyendo `conteo`/`sumaTotal`) en `apps/api/src/modules/invoices/factura.repository.ts` (depende de T010)
- [X] T013 [US2] Endpoint `POST /invoices/:id/delete` en `apps/api/src/modules/invoices/invoices.controller.ts` — marca `eliminadaEn = now()`, `404` si no existe o ya estaba eliminada (idempotente, no usa el verbo HTTP `DELETE` — contracts/api.md) (depende de T012)
- [X] T014 [P] [US2] Menú "···" en `apps/web/src/pages/Detalle.tsx` con la acción "Eliminar factura" + confirmación explícita antes de ejecutar

**Extensión de US2 — fusión real de duplicados confirmados**: validando el bottom sheet de duplicado (US5/US1) se encontró que `DuplicateMatchingService.resolver()` (feature 001) solo cambiaba el estado de la `MarcaPosibleDuplicado` a `duplicado_confirmado` sin actuar nunca sobre las dos facturas — el par quedaba visible para siempre, duplicando montos en los agregados. La spec 001 original nunca definió este comportamiento (su Acceptance Scenario de duplicados solo cubre el caso "son distintas"), pero el copy ya implementado del bottom sheet ("CONSERVAR UNA", "conservamos la copia con más datos") asumía una fusión real. Se resolvió como parte de US2 porque comparte el mismo mecanismo: `resolver()` ahora hace soft-delete (`eliminadaEn = now()`) de una de las dos facturas cuando `resolucion === 'duplicado'`, conservando la que tenga más campos poblados (`contarCamposPoblados` en `duplicate-matching.service.ts`; empate → se conserva la original). Nunca purga nada — misma garantía de recuperabilidad que el resto de T010-T013 (constitution Principio I).

**Checkpoint**: US2 completa y validada — eliminar factura funciona de punta a punta, sin purga automática (Principio I de la constitution).

---

## Phase 5: User Story 3 - Detección de varias facturas en una foto (Priority: P3)

**Goal**: una foto que contiene más de un documento de compra queda marcada de forma distinguible, en vez de generar un registro con datos mezclados.

**Independent Test**: subir una foto con dos documentos visibles y confirmar que el registro `Factura` ya creado al subir la foto transiciona a `varias_facturas` sin poblar ningún campo extraído (spec.md User Story 3, Acceptance Scenarios 1-3).

### Implementación para User Story 3

- [X] T015 [P] [US3] Agregar el valor `'varias_facturas'` a `FacturaEstado` + la transición `procesando → varias_facturas` (terminal, sin salientes) en `packages/domain/src/state-machine/factura-estado.ts`, con test unitario en `packages/domain/test/state-machine.spec.ts`
- [X] T016 [P] [US3] Migración Prisma: agregar `varias_facturas` al enum `FacturaEstado` en `apps/api/prisma/schema.prisma`
- [X] T017 [P] [US3] Agregar campo `múltiplesDocumentos: z.boolean()` a `extractedInvoiceDataSchema` en `packages/domain/src/ports/invoice-extractor.port.ts`, con test unitario en `packages/domain/test/invoice-extractor-port.spec.ts`
- [X] T018 [US3] Actualizar el prompt de extracción compartido en `apps/api/src/modules/extraction/extraction-prompt.ts` con la instrucción para que el modelo señale cuando la imagen contiene más de un documento de compra distinto (depende de T017) — subió `VERSION_PROMPT_EXTRACCION` a `v2` (cambio significativo de contrato, no solo redacción)
- [X] T019 [US3] En `ExtractionProcessor.procesar()`, si `múltiplesDocumentos === true`, transicionar la `Factura` a `varias_facturas` sin persistir ningún otro campo extraído, en `apps/api/src/modules/extraction/extraction.processor.ts` (depende de T015, T016, T018)
- [X] T020 [P] [US3] Estado visual "varias facturas" (color e ícono propios, acción "Separar y recapturar" inline) en `apps/web/src/pages/Captura.tsx` — usa los tokens `--color-estado-varias`/`--color-estado-varias-bg` ya definidos desde Foundational (T003) y el ícono `capas` ya mapeado desde T001, ambos sin usar hasta esta historia; "Separar y recapturar" reutiliza el mismo input de cámara oculto (sin endpoint nuevo, coherente con data-model.md: el usuario recaptura como fotos nuevas e independientes)

**Checkpoint**: US3 completa y validada — el sistema detecta y marca (best-effort) fotos con varias facturas, sin mezclar datos.

---

## Phase 6: User Story 4 - Pantalla de estado vacío (Priority: P4)

**Goal**: un usuario sin facturas ve una pantalla de bienvenida clara en vez de un listado vacío.

**Independent Test**: con cero facturas registradas, abrir el Listado y confirmar la pantalla de estado vacío con su botón primario llevando a Captura (spec.md User Story 4, Acceptance Scenarios 1-2).

### Implementación para User Story 4

- [X] T021 [US4] Crear `apps/web/src/pages/EstadoVacio.tsx` con los tokens del tema activo (ícono, copy, botón primario a Captura, nota secundaria) — comparado contra el mockup exacto "05 · ESTADO VACÍO" del design_handoff; ícono `Receipt`/`ReceiptIcon` nuevo en `theme/iconos.ts`
- [X] T022 [US4] Integrar `EstadoVacio` en `apps/web/src/pages/Listado.tsx` cuando `conteo === 0` (depende de T021) — con el matiz de que solo aplica sin filtros activos (`bibliotecaVacia`); "0 resultados para el filtro actual" sigue mostrando el mensaje genérico existente, no la pantalla de bienvenida. También oculta buscar/filtro/FAB cuando se muestra el estado vacío, coherente con el mockup (que no los tiene)

**Checkpoint**: US4 completa y validada.

---

## Phase 7: User Story 5 - Refinamiento visual de confirmación de duplicado (Priority: P5)

**Goal**: el bottom sheet de posible duplicado (ya funcional) se ve consistente con el resto de la app rediseñada.

**Independent Test**: provocar un duplicado probable y confirmar que el bottom sheet usa los tokens del tema activo sin cambiar su comportamiento de resolución (spec.md User Story 5, Acceptance Scenarios 1-2).

### Implementación para User Story 5

- [X] T023 [US5] Refactorizar `BottomSheetDuplicado` (dentro de `apps/web/src/pages/Listado.tsx`) para usar los tokens del tema activo en vez de sus estilos inline actuales (colores `Canvas`/`CanvasText`) — completado durante la validación exhaustiva de US1: reconstruido contra el markup exacto del diseño (backdrop, drag handle, tarjetas comparativas original/candidata, botones con marcas de esquina), no solo migrado a tokens

**Checkpoint**: las 5 historias funcionan juntas. Validar con `quickstart.md` completo (P1 → P5).

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: mejoras que afectan a varias historias, después de que todas están construidas.

- [X] T024 [P] Actualizar `README.md` con las dependencias nuevas de `apps/web` (paquetes de iconos) y una nota sobre el sistema de temas — agregada sección "Temas visuales" (data-theme, tokens.css, localStorage, fuentes auto-hospedadas)
- [X] T025 Revisar cobertura de tests de dominio (constitution Principio VIII): transición `procesando → varias_facturas` (4 casos en `state-machine.spec.ts`) y el campo `múltiplesDocumentos` (3 casos en `invoice-extractor-port.spec.ts`), ambos agregados durante US3 — 58/58 tests de dominio en verde. `contarCamposPoblados()` (duplicate-matching.service.ts, decide qué factura conservar al fusionar un duplicado) queda sin test unitario dedicado: vive en `apps/api`, no en `packages/domain`, y el criterio pragmático ya establecido en `specs/001-captura-facturas/tasks.md` limita la exigencia de tests unitarios a reglas de dominio — `apps/api` no tiene ningún test unitario en todo el proyecto, ni siquiera para reglas más centrales (elegibilidad, clasificación). No se fuerza aquí por consistencia con ese precedente.
- [X] T026 Verificación estática completa de punta a punta: `tsc --noEmit` + `eslint` + `jest` en `packages/domain` (build, 58/58 tests, typecheck, lint), `apps/api` (typecheck, lint, sin tests por diseño) y `apps/web` (typecheck, lint completo de `src/`) — todo en verde. La validación funcional real de `quickstart.md` (P1→P5) requiere accionar el navegador y no se ejecutó aquí — queda documentada como pendiente manual del usuario en el reporte de cierre de esta fase.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — arranca de inmediato
- **Foundational (Phase 2)**: depende de Setup — bloquea US1, US4 y US5 (las historias visuales); US2 y US3 no dependen técnicamente de esta fase, pero se construyen después por el mismo acuerdo de entrega incremental estricta (nunca en paralelo)
- **User Stories (Phase 3-7)**: en orden de prioridad P1→P5, cada una depende de que la anterior esté completa y validada — no se paralelizan entre sí en este proyecto
- **Polish (Phase 8)**: depende de que las 5 historias estén completas

### Dependencias entre historias

- **US1**: depende de Foundational (Phase 2). Es la única que construye sobre las 3 pantallas principales — el resto de historias la asumen ya completa.
- **US2**: depende de la entidad `Factura` de la feature 001 (la amplía con un campo nuevo, no la reemplaza). No depende de US1.
- **US3**: depende de la máquina de estados y el puerto de extracción de la feature 001 (los amplía). No depende de US1 ni de US2.
- **US4**: depende de los tokens de tema de US1 (Foundational) — es una pantalla nueva que debe verse consistente desde el primer momento.
- **US5**: depende de los tokens de tema de US1 (Foundational) y del bottom sheet ya funcional de la feature 001.

### Parallel Opportunities

- Todas las tareas `[P]` dentro de una misma fase pueden ejecutarse en paralelo (archivos distintos, sin dependencia entre sí)
- Entre fases de historias de usuario: **no ejecutar en paralelo** — mismo motivo que `specs/001-captura-facturas/tasks.md` (proyecto de un solo desarrollador asistido por el agente, acuerdo explícito de fase por fase con validación end-to-end)

---

## Parallel Example: User Story 1

```bash
# Las 3 pantallas son archivos distintos sin dependencia entre sí:
Task: "Refactorizar apps/web/src/pages/Captura.tsx con los tokens del tema"
Task: "Refactorizar apps/web/src/pages/Detalle.tsx con los tokens del tema"
Task: "Refactorizar apps/web/src/pages/Listado.tsx con los tokens del tema"
```

---

## Implementation Strategy

### MVP visual (User Story 1 solamente)

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational (sistema de temas — bloquea US1/US4/US5)
3. Completar Phase 3: User Story 1
4. **DETENERSE y VALIDAR**: probar US1 de forma independiente contra el diseño de referencia y contra `specs/001-captura-facturas/quickstart.md`
5. Confirmación humana antes de continuar con US2

### Entrega incremental

1. Setup + Foundational → sistema de temas listo
2. US1 → validar independientemente → confirmación humana (MVP visual)
3. US2 → validar independientemente → confirmación humana
4. US3 → validar independientemente → confirmación humana
5. US4 → validar independientemente → confirmación humana
6. US5 → validar independientemente → confirmación humana
7. Polish (Phase 8)

Cada historia agrega valor sin romper las anteriores — `/speckit-implement` se invoca acotado a una fase (Setup + Foundational + una historia) a la vez, igual que en `specs/001-captura-facturas`.

---

## Notes

- `[P]` = archivos distintos, sin dependencias entre sí
- La etiqueta `[Story]` mapea cada tarea a su historia de usuario para trazabilidad
- Cada historia debe quedar completable y testeable de forma independiente
- Commitear después de cada historia completa (o antes, si el checkpoint de validación lo amerita), nunca varias historias juntas en un solo commit
- Detenerse en cada checkpoint para validación humana antes de continuar
