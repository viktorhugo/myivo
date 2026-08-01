# Tasks: Registro abierto con aislamiento total entre usuarios

**Input**: Design documents from `/specs/006-multi-usuario/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md — todos completos.

**Tests**: Esta feature es la primera excepción deliberada al criterio "sin tests en `apps/api`" sostenido en 001-005 (plan.md § Testing) — el aislamiento entre cuentas es "no negociable" (constitution Principio VII v2.0.0), así que incluye un test de integración real (T016) además de los tests de dominio habituales (que aquí no aplican: sin reglas de dominio nuevas, `evaluarElegibilidad2026` ya recibía sus parámetros externamente).

**Organization**: Tareas agrupadas por historia de usuario (P1→P2), mismo orden de entrega incremental que las features anteriores. **No se paralelizan entre sí**: `/speckit-implement` se invoca acotado a una fase (Setup + Foundational + una historia) a la vez.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin colisión con otras tareas de la misma fase)
- **[Story]**: Historia de usuario a la que pertenece la tarea (US1, US2)
- Cada tarea incluye la ruta de archivo exacta

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: dependencias nuevas identificadas en research.md — nada de esto depende de ninguna historia.

- [X] T001 Instalar `better-auth` + su adaptador de Prisma en `apps/api/package.json` (research.md § 1)
- [X] T002 Instalar `resend` en `apps/api/package.json` (research.md § 2)
- [X] T003 Instalar `@nestjs-cls/transactional` en `apps/api/package.json` (research.md § 3)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: el modelo de cuentas, el mecanismo de aislamiento (RLS + interceptor), y la migración de los datos ya existentes — ninguna historia puede empezar sin esto.

**⚠️ CRITICAL**: ninguna historia puede empezar hasta que esta fase esté completa.

- [X] T004 Prisma schema (`apps/api/prisma/schema.prisma`): agregar los modelos que exige el adaptador de Better Auth (usuario, sesión, verificación) + `Factura.usuarioId` (FK obligatoria, `NOT NULL`) (data-model.md § Usuario, § Factura) (depende de T001)
- [X] T005 Migración SQL cruda con las políticas de Row-Level Security en `Factura` y en las tablas que dependen de ella (`ItemFactura`, `CorreccionManual`, `ExtraccionCruda`, `MarcaPosibleDuplicado`, `ValidacionDian`), comparando contra la variable de sesión `app.usuario_id` — archivo nuevo en `apps/api/prisma/migrations/` (research.md § 3, data-model.md § Aislamiento a dos capas). Prisma no expresa RLS nativamente, por eso es SQL crudo, no un cambio a `schema.prisma` (depende de T004)
- [X] T006 [P] `rls-transaction.interceptor.ts` en `apps/api/src/modules/auth/`: envuelve cada request en una transacción de Prisma y fija `SET LOCAL app.usuario_id` dentro de esa misma transacción (nunca fuera, nunca con `SET` a secas — research.md § 3), propagada a través de los servicios con `@nestjs-cls/transactional` (depende de T003, T005)
- [X] T007 Reemplazar el módulo `auth` actual por Better Auth en `apps/api/src/modules/auth/auth.module.ts` — registro, verificación de correo (vía Resend), inicio/cierre de sesión, cambio de contraseña; elimina `auth.service.ts`/`auth.controller.ts`/`dto/login.dto.ts` existentes (contracts/api.md § Autenticación) (depende de T001, T002, T004)
- [X] T008 `session-usuario.guard.ts` en `apps/api/src/modules/auth/guards/`, reemplaza `session-auth.guard.ts`: autentica igual que hoy y además expone el `usuarioId` de la sesión en la request, para que T006 lo use (depende de T007)
- [X] T009 [P] `apps/api/src/config/env.schema.ts`: eliminar `AUTH_USERNAME`/`AUTH_PASSWORD_HASH`/`MIS_IDENTIFICACIONES`; agregar las variables que exigen Better Auth y Resend (depende de T007)
- [X] T010 Script de migración de datos (no de esquema) en `apps/api/prisma/` o `apps/api/scripts/`: crea la cuenta de Victor ya verificada (sin pasar por el flujo de registro) y asigna su `usuarioId` a todas las filas de `Factura` ya existentes — ejecución única al desplegar (research.md § 4, data-model.md § Migración). **Este script y las migraciones de Prisma (T004/T005) contra la base de datos real los ejecuta el usuario — nunca el asistente** (depende de T004)

**Checkpoint**: cuentas, aislamiento, y migración listos — ambas historias pueden construirse sobre esto.

---

## Phase 3: User Story 1 - Registro abierto con verificación de correo y aislamiento total de datos (Priority: P1) 🎯 MVP

**Goal**: cualquier persona se registra por su cuenta, verifica su correo, y desde ese momento sus datos están completamente aislados de cualquier otra cuenta en todas las funcionalidades ya existentes.

**Independent Test**: dos cuentas se registran y verifican sin intervención de un tercero, cada una captura sus propias facturas, corrige campos, concilia con la DIAN, y consulta su reporte anual — se verifica que ninguna puede ver, listar, ni acceder (ni por un enlace directo con el ID de un registro ajeno) a ningún dato de la otra, en ninguna pantalla ni endpoint (spec.md User Story 1, Acceptance Scenarios 1-9).

### Implementación para User Story 1

- [X] T011 [US1] `apps/web/src/pages/Login.tsx`: agrega el formulario de registro (correo + contraseña) y la pantalla de "verifica tu correo" — bloquea el uso de la app hasta verificar (FR-001, FR-002)
- [X] T012 [US1] `factura.repository.ts` en `apps/api/src/modules/invoices/`: todo método de consulta gana `usuarioId` explícito en su `where` de Prisma — defensa en profundidad, RLS (T005) es la garantía real (FR-004) (depende de T008)
- [X] T013 [P] [US1] `duplicate-matching.service.ts`: la detección de posibles duplicados queda acotada a la misma cuenta — nunca compara facturas de cuentas distintas (FR-006) (depende de T008)
- [X] T014 [P] [US1] `validacion-dian.repository.ts` (individual y conciliación en lote, `apps/api/src/modules/validacion-dian/`): + `usuarioId` en toda consulta (FR-004) (depende de T008)
- [X] T015 [P] [US1] `reporte-anual.service.ts` en `apps/api/src/modules/reportes/`: + `usuarioId` (FR-004) (depende de T008)
- [X] T016 [US1] Test de integración `apps/api/test/aislamiento-cuentas.e2e-spec.ts`: dos cuentas reales, cada una captura sus propias facturas; verifica que ninguna puede ver/listar/acceder a los datos de la otra en Listado, Detalle (incluido acceso directo por ID ajeno — debe comportarse como inexistente), duplicados, conciliación DIAN, y reporte anual (plan.md § Testing, excepción deliberada) (depende de T012, T013, T014, T015)

**Checkpoint**: US1 completa y validada — el aislamiento es real, no solo una promesa de diseño.

---

## Phase 4: User Story 2 - Gestionar mi propia cuenta (Priority: P2)

**Goal**: cambiar mi propia contraseña y configurar mi identificación tributaria propia desde la app, sin depender de que alguien más edite un archivo de configuración.

**Independent Test**: con una cuenta ya registrada y verificada (User Story 1), cambiar la contraseña y la identificación tributaria propia desde la app, y verificar que el cambio se refleja de inmediato — al iniciar sesión la próxima vez, y en la elegibilidad de la próxima factura capturada (spec.md User Story 2, Acceptance Scenarios 1-2).

### Implementación para User Story 2

- [X] T017 [P] [US2] Endpoint `GET`/`PUT /cuenta/identificaciones` — controller nuevo en `apps/api/src/modules/auth/cuenta.controller.ts` (contracts/api.md § Identificaciones tributarias propias, FR-007) (depende de T008)
- [X] T018 [P] [US2] Confirmar/exponer el cambio de contraseña propia de Better Auth (T007) — si no queda expuesto por defecto, envolverlo en un endpoint propio (FR-009, contracts/api.md)
- [X] T019 [US2] `apps/web/src/pages/CuentaPropia.tsx`: pantalla nueva — cambiar contraseña + configurar identificaciones tributarias propias (depende de T017, T018)

**Checkpoint**: US1 y US2 completas — cada cuenta gestiona su propio acceso y su propia configuración tributaria, sin ningún archivo de configuración compartido.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: mejoras que afectan a ambas historias, después de que están construidas.

- [X] T020 [P] Actualizar `README.md`: sección nueva sobre registro/cuentas, actualizar "Requisitos" y variables de entorno (ya no `AUTH_USERNAME`/`AUTH_PASSWORD_HASH`/`MIS_IDENTIFICACIONES`), nota sobre Resend y Row-Level Security — mismo estilo que las secciones ya agregadas para 002-005
- [X] T021 Verificación estática completa de punta a punta: `tsc` + `eslint` en `packages/domain`, `apps/api`, `apps/web`; `jest` en `packages/domain` (70 tests existentes, sin cambios) y en `apps/api` (incluye T016, esta vez sí en verde, no "sin tests"). La validación funcional real de `quickstart.md` (P1→P2 con dos cuentas y correos reales) requiere accionar el navegador y correos reales, y no se ejecuta aquí — queda documentada como pendiente manual del usuario. **Recordatorio explícito**: las migraciones de Prisma (T004/T005) y el script de datos (T010) contra la base de datos real los ejecuta el usuario — nunca el asistente, en ningún punto de esta feature.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — arranca de inmediato
- **Foundational (Phase 2)**: depende de Setup — bloquea US1 y US2
- **User Stories (Phase 3-4)**: en orden de prioridad P1→P2, cada una depende de que la anterior esté completa y validada — no se paralelizan entre sí en este proyecto
- **Polish (Phase 5)**: depende de que ambas historias estén completas

### Dependencias entre historias

- **US1**: depende de Foundational (Phase 2). No depende de US2.
- **US2**: depende de Foundational (Phase 2). Reusa el módulo de auth creado en Foundational (T007/T008) pero su superficie (identificaciones propias, cambio de contraseña) es independiente de que US1 esté siquiera terminada de usar en producción — solo comparte infraestructura, no resultado.

### Parallel Opportunities

- Todas las tareas `[P]` dentro de una misma fase pueden ejecutarse en paralelo (archivos distintos, sin colisión entre sí)
- Entre fases de historias de usuario: **no ejecutar en paralelo** — mismo motivo que las features anteriores

---

## Parallel Example: User Story 1

```bash
# Una vez T008 (Foundational) está listo, son archivos distintos:
Task: "usuarioId en duplicate-matching.service.ts"
Task: "usuarioId en validacion-dian.repository.ts"
Task: "usuarioId en reporte-anual.service.ts"
```

---

## Implementation Strategy

### MVP visual (User Story 1 solamente)

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational (cuentas, aislamiento, migración — bloquea US1/US2)
3. Completar Phase 3: User Story 1
4. **DETENERSE y VALIDAR**: probar US1 de forma independiente contra `quickstart.md` § P1, con dos cuentas y correos reales
5. Confirmación humana antes de continuar con US2

### Entrega incremental

1. Setup + Foundational → cuentas y aislamiento listos (incluida la migración de los datos actuales de Victor, ejecutada por él)
2. US1 → validar independientemente con dos cuentas reales → confirmación humana (MVP)
3. US2 → validar independientemente → confirmación humana
4. Polish (Phase 5)

Cada historia agrega valor sin romper la anterior — `/speckit-implement` se invoca acotado a una fase (Setup + Foundational + una historia) a la vez, igual que en `specs/001-captura-facturas` a `specs/005-captura-pdf-facturas`.

---

## Notes

- `[P]` = archivos distintos, sin colisión con otras tareas de la misma fase (algunas tareas `[P]` dependen igual de una tarea anterior — la dependencia se anota entre paréntesis)
- La etiqueta `[Story]` mapea cada tarea a su historia de usuario para trazabilidad
- T016 es la primera tarea de test de integración en `apps/api` de todo el proyecto — es una excepción deliberada, no el inicio de una nueva política general de testing (plan.md § Testing)
- T004, T005, y T010 tocan la base de datos real — el usuario las ejecuta él mismo y avisa cuándo están hechas, nunca el asistente (acuerdo vigente durante toda la sesión)
- Commitear después de cada historia completa, nunca varias historias juntas en un solo commit
- Detenerse en cada checkpoint para validación humana antes de continuar
