---

description: "Task list for Captura y Registro Estructurado de Facturas"
---

# Tasks: Captura y Registro Estructurado de Facturas

**Input**: Design documents from `/specs/001-captura-facturas/`

**Prerequisites**: plan.md, spec.md, data-model.md, contracts/api.md, research.md, quickstart.md — todos presentes.

**Tests**: Se incluyen tareas de test unitario únicamente para reglas de dominio (tributarias, cuadre monetario, máquina de estados, duplicados) — exigido por la constitution (Principio VIII). No se generan tests de contrato/integración por endpoint: la cobertura de infraestructura es pragmática, no dogmática (constitution Principio VIII).

**Organización**: por historia de usuario, en el orden de prioridad del spec (P1 → P5), para permitir implementación y validación independientes de cada una.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ejecutarse en paralelo (archivos distintos, sin dependencias entre sí)
- **[Story]**: historia de usuario a la que pertenece la tarea (US1-US5), según spec.md
- Cada tarea incluye la ruta de archivo exacta

## Path Conventions (monorepo pnpm + Turborepo — ver plan.md § Project Structure)

- `packages/domain/src/` — dominio puro (entidades, máquina de estados, reglas tributarias, puertos)
- `apps/api/src/` — NestJS (controladores, adaptadores, Prisma)
- `apps/web/src/` — Vite + React (páginas, componentes, servicios)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: inicialización del monorepo y su infraestructura base.

- [X] T001 Crear estructura de monorepo pnpm + Turborepo (`apps/api`, `apps/web`, `packages/domain`) según `plan.md` § Project Structure
- [X] T002 [P] Inicializar `packages/domain`: `package.json`, `tsconfig.json` en modo estricto, sin dependencias de runtime externas
- [X] T003 [P] Inicializar `apps/api`: proyecto NestJS con `tsconfig.json` en modo estricto
- [X] T004 [P] Inicializar `apps/web`: proyecto Vite + React con `tsconfig.json` en modo estricto
- [X] T005 [P] Configurar ESLint + Prettier compartidos en la raíz del monorepo
- [X] T006 Configurar `turbo.json` con pipelines `build`/`test`/`lint` entre `packages/domain`, `apps/api` y `apps/web`
- [X] T007 [P] Crear `docker-compose.yml` base: servicio PostgreSQL + volumen Docker para imágenes + red interna
- [X] T008 [P] Configurar Caddy (`Caddyfile`) como reverse proxy con TLS automático delante de `apps/api` y `apps/web`
- [X] T009 Configurar variables de entorno con validación Zod al arranque de `apps/api` (`.env.example` + validación) — constitution Principio VII

**Checkpoint**: el monorepo compila y `docker compose up` levanta contenedores vacíos pero funcionales.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: infraestructura que TODAS las historias necesitan antes de empezar.

**⚠️ CRÍTICO**: ninguna historia de usuario se implementa hasta completar esta fase.

- [X] T010 Inicializar Prisma en `apps/api/prisma/schema.prisma` conectado al servicio PostgreSQL de `docker-compose.yml` (primera migración de conexión, sin modelo de dominio todavía)
- [X] T011 [P] Implementar autenticación de sesión de un solo usuario en `apps/api/src/modules/auth/` (login/logout, cookie firmada `httpOnly`+`secure`, hash Argon2) — FR-030, requisito transversal sin historia propia
- [X] T012 [P] Configurar middleware de manejo de errores y logging estructurado en `apps/api/src/main.ts`
- [X] T013 Crear el puerto `InvoiceExtractor` en `packages/domain/src/ports/invoice-extractor.port.ts` (solo la interfaz, sin adaptador) — constitution Principio V
- [X] T014 [P] Definir los tipos y transiciones permitidas de la máquina de estados en `packages/domain/src/state-machine/factura-estado.ts`, según la tabla de `data-model.md`

**Checkpoint**: auth funcionando, DB conectada, dominio con el puerto de extracción definido. A partir de aquí empieza User Story 1.

---

## Phase 3: User Story 1 - Capturar una factura (Priority: P1) 🎯 MVP

**Goal**: la foto se guarda de inmediato, con un estado visible, sin depender de que exista ningún procesamiento posterior.

**Independent Test**: tomar o subir una o varias fotos y verificar que cada una queda guardada y visible con su propio estado, sin que exista todavía extracción, clasificación ni consulta avanzada (spec.md, User Story 1).

### Tests para User Story 1

- [X] T015 [P] [US1] Test unitario de transiciones válidas/inválidas de `Factura.estado` en `packages/domain/test/state-machine.spec.ts` — constitution Principio VIII exige test para la máquina de estados

### Implementación para User Story 1

- [X] T016 [P] [US1] Crear la entidad `Factura` (campos mínimos: `id`, `estado`, `rutaImagenOriginal`, `derivados`, `creadaEn`, `actualizadaEn`) en `packages/domain/src/entities/factura.ts` — el resto de campos de `data-model.md` se añade en US2/US3
- [X] T017 [US1] Migración Prisma: tabla `Factura` con los campos de T016 en `apps/api/prisma/schema.prisma`
- [X] T018 [US1] Repositorio Prisma de `Factura` (crear, obtener por id, actualizar estado) en `apps/api/src/modules/invoices/factura.repository.ts`
- [X] T019 [US1] Servicio de almacenamiento de archivos — escribe en el volumen Docker, nunca sobrescribe el original (constitution Principio I, FR-005) en `apps/api/src/modules/invoices/file-storage.service.ts`
- [X] T020 [US1] Endpoint `POST /invoices` (multipart, uno o varios archivos): guarda cada imagen de inmediato y crea una `Factura` en estado `recibida` por archivo, de forma independiente entre sí (FR-001/FR-002/FR-003) en `apps/api/src/modules/invoices/invoices.controller.ts`
- [X] T021 [US1] Endpoint `GET /invoices/:id/image`: sirve el byte-stream original sin importar el `estado` de la factura — soporta el escenario "el procesamiento falla pero la foto sigue disponible" en `apps/api/src/modules/invoices/invoices.controller.ts`
- [X] T022 [US1] Endpoint `GET /invoices/:id` (versión mínima: `estado` + metadata de imagen; US2 le añade los campos extraídos) en `apps/api/src/modules/invoices/invoices.controller.ts`
- [X] T023 [P] [US1] Página de captura — input de cámara/archivo, subida en lote, lista con el estado de cada foto — en `apps/web/src/pages/Captura.tsx`
- [X] T024 [US1] Cliente HTTP hacia `POST /invoices` y `GET /invoices/:id` en `apps/web/src/services/invoices.ts`

**Checkpoint**: User Story 1 es una MVP demostrable de punta a punta — foto → guardada → estado visible — sin depender de extracción. Validar con `quickstart.md` § H1 antes de continuar.

---

## Phase 4: User Story 2 - Extracción automática de datos (Priority: P2)

**Goal**: los datos de la factura fotografiada se extraen automáticamente, sin digitación manual.

**Independent Test**: con una factura ya almacenada (User Story 1), verificar que el sistema propone valores estructurados con su nivel de confianza, sin depender de clasificación tributaria ni consulta (spec.md, User Story 2).

### Implementación para User Story 2

- [X] T025 [P] [US2] Ampliar la entidad `Factura` con los campos de `data-model.md` (comercio, fecha/hora, moneda, montos, IVA por tarifa, medio de pago, adquiriente, CUFE, `confianzaCampos`) en `packages/domain/src/entities/factura.ts`
- [X] T026 [US2] Migración Prisma: ampliar tabla `Factura` + crear tablas `ItemFactura`, `ExtraccionCruda` y `CorreccionManual` en `apps/api/prisma/schema.prisma`
- [X] T027 [P] [US2] Adaptador `InvoiceExtractor` sobre Claude API (`claude-sonnet-5`, `output_config.format`) en `apps/api/src/modules/extraction/claude-invoice-extractor.adapter.ts` — research.md § 3
- [X] T028 [P] [US2] Decodificador determinístico de CUFE/CUDE desde QR (nunca vía LLM) en `apps/api/src/modules/extraction/cufe-decoder.ts` — constitution Principio III, FR-007/FR-008
- [X] T029 [US2] Schema Zod de validación de la salida del extractor antes de persistir en el dominio, en `packages/domain/src/ports/invoice-extractor.port.ts` — constitution Principio III
- [X] T030 [P] [US2] Regla de dominio pura de cuadre monetario (`subtotal + IVA + propina ≠ total → necesita_revisión`), con test unitario, en `packages/domain/src/tax-rules/cuadre-monetario.ts` — constitution Principios II/VIII, FR-010
- [X] T031 [US2] Orquestador de extracción: toma facturas en `recibida`, invoca extractor + decodificador CUFE, aplica cuadre monetario, transiciona el estado (`procesando → extraída` / `necesita_revisión` / `fallida`) en `apps/api/src/modules/extraction/extraction.processor.ts`
- [X] T032 [US2] Endpoint `PATCH /invoices/:id/fields`: corrección manual de campos, crea un registro `CorreccionManual` por campo (FR-011/FR-012) en `apps/api/src/modules/invoices/invoices.controller.ts`
- [X] T033 [US2] Endpoint `POST /invoices/:id/reprocess`: reintento de extracción para facturas en `fallida` (FR-013) en `apps/api/src/modules/invoices/invoices.controller.ts`
- [X] T034 [US2] Ampliar `GET /invoices/:id` con todos los campos extraídos, `confianzaCampos` y correcciones previas
- [X] T035 [P] [US2] Vista de detalle — foto colapsable arriba, campos editables abajo, indicador de confianza por campo (punto de color) — en `apps/web/src/pages/Detalle.tsx`

**Checkpoint**: las facturas capturadas en US1 ahora se extraen automáticamente y son corregibles. Validar con `quickstart.md` § H2.

---

### Extensión de User Story 2 — Selección de proveedor de extracción (FR-031)

**Goal**: el proveedor y modelo de extracción (Claude, OpenAI, Gemini, u otros compatibles con la API de OpenAI) se elige por configuración, sin tocar código — research.md § 10.

- [X] T054 [US2] Ampliar el schema Zod de entorno con `EXTRACTION_PROVIDER`, `EXTRACTION_MODEL` y una API key por proveedor, exigiendo en el arranque solo la del proveedor activo, en `apps/api/src/config/env.schema.ts`
- [X] T055 [P] [US2] Extraer el prompt de extracción (ya usado por Claude) a un módulo compartido por todos los adaptadores, en `apps/api/src/modules/extraction/extraction-prompt.ts`
- [X] T056 [P] [US2] Adaptador `InvoiceExtractor` sobre OpenAI (`chat.completions.parse` + `zodResponseFormat`) en `apps/api/src/modules/extraction/openai-invoice-extractor.adapter.ts`
- [X] T057 [P] [US2] Adaptador `InvoiceExtractor` sobre Google Gemini (`generateContent` + `responseJsonSchema` vía `z.toJSONSchema()`) en `apps/api/src/modules/extraction/gemini-invoice-extractor.adapter.ts`
- [X] T058 [P] [US2] Adaptador genérico `InvoiceExtractor` para proveedores compatibles con la API de OpenAI (Z.ai, Qwen/DashScope, Kimi/Moonshot), configurable por `baseURL`/modelo/API key, en `apps/api/src/modules/extraction/openai-compatible-invoice-extractor.adapter.ts`
- [X] T059 [US2] Fábrica de selección de adaptador según `EXTRACTION_PROVIDER` en `apps/api/src/modules/extraction/extraction.module.ts`

**Checkpoint**: cambiar `EXTRACTION_PROVIDER` en `.env` y reiniciar cambia de proveedor sin editar código.

---

## Phase 5: User Story 3 - Clasificación tributaria y elegibilidad (Priority: P3)

**Goal**: cada documento queda clasificado por tipo y con una marca de elegibilidad tributaria calculada.

**Independent Test**: con una factura ya extraída (User Story 2), verificar que queda clasificada y con elegibilidad + motivo, de forma aislada de consulta o duplicados (spec.md, User Story 3).

### Implementación para User Story 3

- [X] T036 [P] [US3] Regla de dominio pura de clasificación por tipo de documento (taxonomía de 5 tipos), con test unitario, en `packages/domain/src/tax-rules/clasificacion-documento.ts` — constitution Principio IV
- [X] T037 [P] [US3] Regla de dominio pura de elegibilidad tributaria (tipo de documento + identificación + medio de pago → elegible/no + motivo), con tests unitarios cubriendo los 4 escenarios del spec y cita de fuente normativa en comentario, en `packages/domain/src/tax-rules/elegibilidad.ts` — constitution Principio IV, FR-015 a FR-018
- [X] T038 [US3] Integrar clasificación + elegibilidad en el orquestador de extracción (T031): se calculan automáticamente al terminar la extracción (tanto si queda `extraída` como `necesita_revisión` — ambas ya tienen datos que clasificar)
- [X] T039 [US3] Recalcular elegibilidad automáticamente al guardar una corrección manual que afecte campos relevantes, en el endpoint de T032 (FR-017)
- [X] T040 [P] [US3] Mostrar marca de elegibilidad + motivo en `apps/web/src/pages/Detalle.tsx`, con el aviso "el sistema organiza, no emite concepto tributario" — constitution Principio IV

**Checkpoint**: cada factura extraída queda clasificada y con elegibilidad calculada. Validar con `quickstart.md` § H3.

---

## Phase 6: User Story 4 - Consulta y filtrado de facturas (Priority: P4)

**Goal**: listar y filtrar facturas, con el detalle de cada una junto a su foto original.

**Independent Test**: con un conjunto de facturas ya cargadas en distintos estados, verificar que se pueden listar, filtrar por cada criterio y abrir el detalle (spec.md, User Story 4).

### Implementación para User Story 4

- [X] T041 [US4] Endpoint `GET /invoices` con filtros combinables (fecha, comercio, monto, tipo, elegibilidad, estado) + agregado de conteo/suma en COP en `apps/api/src/modules/invoices/invoices.controller.ts` — FR-022/FR-023/FR-027
- [X] T042 [P] [US4] Página de listado — filtros, total agregado destacado, botón flotante de captura — en `apps/web/src/pages/Listado.tsx`
- [X] T043 [US4] Enlazar el detalle (T022/T034) desde la lista de resultados en `apps/web/src/pages/Listado.tsx`

**Checkpoint**: se puede responder "¿cuánto llevo elegible este año?" sin sumar a mano. Validar con `quickstart.md` § H4.

---

## Phase 7: User Story 5 - Detección de duplicados (Priority: P5)

**Goal**: detectar cuando se sube dos veces la misma factura, sin inflar el registro acumulado.

**Independent Test**: subir dos fotos que representan la misma compra y verificar que el sistema detecta la coincidencia y actúa según haya o no CUFE, de forma aislada de clasificación o consulta (spec.md, User Story 5).

### Implementación para User Story 5

- [X] T044 [P] [US5] Migración Prisma: tabla `MarcaPosibleDuplicado` (+ extensión `pg_trgm`, columna `comercioNombreNormalizado`) en `apps/api/prisma/schema.prisma`
- [X] T045 [P] [US5] Regla de dominio pura de duplicado exacto por CUFE, con test unitario, en `packages/domain/src/duplicates/duplicado-exacto.ts`
- [X] T046 [P] [US5] Regla de coincidencia difusa (comercio normalizado vía `pg_trgm` + fecha/total exactos), con test de integración, en `apps/api/src/modules/invoices/duplicate-matching.service.ts` — research.md § 6
- [X] T047 [US5] Integrar detección de duplicados en el orquestador de extracción (T031) — nunca bloquea el resto de un lote en carga (FR-021)
- [X] T048 [US5] Endpoints `GET /invoices/duplicates/pending` y `POST /invoices/duplicates/:id/resolve` en `apps/api/src/modules/invoices/invoices.controller.ts`
- [X] T049 [P] [US5] Bottom sheet de confirmación de duplicado sobre el listado en `apps/web/src/pages/Listado.tsx`

**Checkpoint**: las 5 historias funcionan juntas. Validar con `quickstart.md` § H5 (validación completa end-to-end del MVP).

### Extensión de User Story 5 — CUFE por OCR no excluye el mecanismo difuso (FR-020)

Hallazgo de la validación end-to-end con fotos reales (research.md § 6): la misma factura fotografiada dos veces produjo CUFEs distintos en un carácter porque el QR no era legible y el CUFE se leyó por OCR — ni el mecanismo exacto (FR-019) ni el difuso (FR-020, que excluía cualquier documento con CUFE) detectaban ese caso.

- [X] T060 [US5] Un CUFE con `cufeOrigen: 'ocr_respaldo'` (no `'qr'`) ya no excluye el mecanismo difuso cuando no hay coincidencia exacta, en `apps/api/src/modules/invoices/duplicate-matching.service.ts` — verificado de nuevo con la misma foto real (D1) subida dos veces

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: mejoras que afectan a varias historias, después de que todas están construidas.

- [ ] T050 [P] Documentación de despliegue (README con `docker compose up`, costo operativo esperado de `research.md`)
- [X] T051 Revisar cobertura de tests de dominio (constitution Principio VIII): todas las reglas tributarias, monetarias y de máquina de estados con test unitario
- [X] T052 [P] Configurar prompt caching en el adaptador de extracción (research.md § 3) para el system prompt/schema, reduciendo costo desde la segunda llamada
- [X] T053 Ejecutar la validación completa de `quickstart.md` de punta a punta (H1 → H5)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — arranca de inmediato
- **Foundational (Phase 2)**: depende de Setup — bloquea las 5 historias
- **User Stories (Phase 3-7)**: cada una depende de Foundational y de la(s) historia(s) anterior(es) en orden de prioridad (ver abajo) — **no se paralelizan entre sí en este proyecto**, porque el acuerdo de entrega es incremental y validado, no un equipo trabajando varias historias a la vez
- **Polish (Phase 8)**: depende de que las 5 historias estén completas

### Dependencias entre historias (entrega incremental, no independencia total)

A diferencia del patrón genérico de Spec Kit (historias independientes en paralelo), aquí cada historia **construye sobre el esquema de datos de la anterior**:

- **US1**: sin dependencias de otra historia. Es la única verdaderamente independiente.
- **US2**: depende de la tabla `Factura` de US1 (la amplía con `ALTER`, no la reemplaza)
- **US3**: depende de los campos extraídos por US2 (tipo de documento, medio de pago, adquiriente)
- **US4**: depende de que existan facturas con datos de US2/US3 para que filtrar tenga sentido (aunque el endpoint de listado en sí solo necesita el esquema de US1)
- **US5**: depende del CUFE y la extracción de comercio/fecha/total de US2

### Parallel Opportunities

- Todas las tareas `[P]` dentro de una misma fase pueden ejecutarse en paralelo (archivos distintos, sin dependencia entre sí)
- Entre fases de historias de usuario: **no ejecutar en paralelo** — este proyecto es de un solo desarrollador (asistido por el agente) y el acuerdo explícito es fase por fase, con validación end-to-end antes de continuar, precisamente para evitar que el agente pierda coherencia manejando varias historias a la vez

---

## Parallel Example: User Story 1

```bash
# Estas tareas de US1 pueden lanzarse juntas (archivos distintos, sin dependencias entre sí):
Task: "Test unitario de transiciones de Factura.estado en packages/domain/test/state-machine.spec.ts"
Task: "Crear la entidad Factura en packages/domain/src/entities/factura.ts"
# T017-T022 son secuenciales (cada una depende de la anterior: migración → repositorio → servicio → endpoints)
# T023 (página de captura) puede avanzar en paralelo a T017-T022 usando el contrato de contracts/api.md como mock
```

---

## Implementation Strategy — MVP primero, entrega incremental por fases

Este es el punto operativo más importante de este `tasks.md`, acordado explícitamente con el usuario: **`/speckit-implement` NO se invoca una sola vez para todo el archivo**. Se invoca **una fase a la vez**, con validación humana entre cada una.

1. **Fase 1**: `/speckit-implement` acotado a Phase 1 (Setup) + Phase 2 (Foundational). Al terminar: el monorepo compila, la DB conecta, el login funciona.
2. **Fase 2 — MVP**: `/speckit-implement` acotado a Phase 3 (User Story 1). Al terminar: **detenerse y validar** con `quickstart.md` § H1 antes de continuar. Este es el primer punto en que hay algo demostrable.
3. **Fase 3**: `/speckit-implement` acotado a Phase 4 (User Story 2). Validar con `quickstart.md` § H2.
4. **Fase 4**: `/speckit-implement` acotado a Phase 5 (User Story 3). Validar con `quickstart.md` § H3.
5. **Fase 5**: `/speckit-implement` acotado a Phase 6 (User Story 4). Validar con `quickstart.md` § H4.
6. **Fase 6**: `/speckit-implement` acotado a Phase 7 (User Story 5). Validar con `quickstart.md` § H5.
7. **Fase 7**: `/speckit-implement` acotado a Phase 8 (Polish).

**Por qué en este orden y no en paralelo**: evita que el agente acumule demasiado contexto de golpe (la razón original de este acuerdo) y da un punto de validación humana real después de cada historia — si algo del plan no encaja con la realidad (p. ej. el modelo de extracción no da la precisión esperada en H2), se descubre con una sola historia construida, no con cinco.

## Notes

- `[P]` = archivos distintos, sin dependencias
- `[Story]` mapea cada tarea a su historia para trazabilidad
- Commit al terminar cada tarea o grupo lógico
- Detenerse en cada Checkpoint a validar contra `quickstart.md` antes de continuar
- Evitar: tareas vagas, conflictos de mismo archivo, dependencias cruzadas entre historias que rompan la independencia de US1
