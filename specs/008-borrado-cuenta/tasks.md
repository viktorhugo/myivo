# Tasks: Borrado de Cuenta con Purga Diferida

**Input**: Design documents from `specs/008-borrado-cuenta/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/cuenta-eliminacion.md, quickstart.md

**Tests**: Incluidos — esta feature es, igual que `aislamiento-cuentas.e2e-spec.ts`, una de las
excepciones deliberadas a "sin tests en apps/api" (constitution Principio VIII: integridad de
datos entre cuentas no negociable). Se siguen con RED antes de la implementación.

**Organization**: Tareas agrupadas por historia de usuario (spec.md), en su orden de prioridad.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Agregar `eliminacionSolicitadaEn: DateTime?` y `eliminacionProgramadaPara: DateTime?` a `User` en `apps/api/prisma/schema.prisma`; correr `pnpm --filter @myivo/api prisma migrate dev` para generar la migración.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: bloquea ambas historias P1 (US1, US2) — ninguna puede completarse sin esto.

- [X] T002 Extender `SessionUsuarioGuard` (`apps/api/src/modules/auth/guards/session-usuario.guard.ts`): si el usuario resuelto tiene `eliminacionProgramadaPara` no nulo, rechazar la request (mismo resultado que sin sesión) salvo que la ruta sea `/cuenta/eliminacion` (GET/POST) o `/cuenta/eliminacion/cancelar` (POST). Depende de T001.

**Checkpoint**: Esquema + guard listos — las historias de usuario pueden empezar.

---

## Phase 3: User Story 1 - Borrado inmediato (Priority: P1) 🎯 MVP

**Goal**: un usuario autenticado inicia el borrado desde la app y la cuenta queda inaccesible al instante, con la ventana de 30 días informada.

**Independent Test**: `quickstart.md` § Escenario 1.

### Tests for User Story 1 ⚠️

> Escribir primero, confirmar que fallan (RED) antes de implementar.

- [X] T003 [P] [US1] Crear `apps/api/test/eliminacion-cuenta.e2e-spec.ts` (mismo bootstrap real de Nest + Better Auth que `aislamiento-cuentas.e2e-spec.ts`) con 3 casos RED: (a) `POST /cuenta/eliminacion` con el correo real → `200` + `eliminacionProgramadaPara` ~30 días adelante, y un `GET /invoices` inmediatamente después con la misma cookie → `403`; (b) correo incorrecto → `400`, sin cambios de estado; (c) segunda solicitud sobre una cuenta que ya tiene eliminación programada → `409` con la fecha vigente (FR-011).

### Implementation for User Story 1

- [X] T004 [US1] Crear `CuentaEliminacionService.solicitar(usuarioId, correoConfirmacion)` en `apps/api/src/modules/auth/cuenta-eliminacion.service.ts`: valida que el correo coincida (400 si no), rechaza si ya hay una eliminación programada (409 + fecha vigente), si no fija ambos campos de fecha y revoca todas las sesiones (`prisma.session.deleteMany({ where: { userId } })`). Depende de T001.
- [X] T005 [US1] Crear `CuentaEliminacionController` en `apps/api/src/modules/auth/cuenta-eliminacion.controller.ts` con `POST /cuenta/eliminacion` (contrato en `contracts/cuenta-eliminacion.md`), protegido por `SessionUsuarioGuard`, registrado en `apps/api/src/modules/auth/auth.module.ts`. Depende de T002, T004.
- [X] T006 [US1] Agregar sección "Eliminar mi cuenta" a `apps/web/src/pages/CuentaPropia.tsx`: confirmación deliberada (repetir el correo de la cuenta), llama al endpoint nuevo, muestra el aviso de la ventana de 30 días, y al confirmar limpia la sesión local y redirige a login. Depende de T005.
- [X] T007 [US1] Correr los tests de T003, confirmar GREEN.

**Checkpoint**: US1 funciona de forma independiente — pedir el borrado bloquea la cuenta al instante.

---

## Phase 4: User Story 2 - Revertir dentro de la ventana (Priority: P1)

**Goal**: dentro de los 30 días, el titular puede ver el estado de su eliminación programada y cancelarla sin perder datos.

**Independent Test**: `quickstart.md` § Escenario 2.

### Tests for User Story 2 ⚠️

- [X] T008 [P] [US2] Extender `apps/api/test/eliminacion-cuenta.e2e-spec.ts` con 3 casos RED: (a) `GET /cuenta/eliminacion` sobre cuenta con eliminación programada → `200` con la fecha; sobre cuenta activa → `200` con `eliminacionProgramadaPara: null`; (b) `POST /cuenta/eliminacion/cancelar` sobre cuenta con eliminación programada → `200`, `eliminacionProgramadaPara: null`, y `GET /invoices` vuelve a responder `200` con la factura previa intacta; (c) `POST cancelar` sobre cuenta sin eliminación programada → `409`.

### Implementation for User Story 2

- [X] T009 [US2] Agregar `obtenerEstado(usuarioId)` y `cancelar(usuarioId)` a `CuentaEliminacionService` (mismo archivo de T004): `cancelar` limpia solo `eliminacionProgramadaPara` (conserva `eliminacionSolicitadaEn` como historial, D7), `409` si no hay nada que cancelar.
- [X] T010 [US2] Agregar `GET /cuenta/eliminacion` y `POST /cuenta/eliminacion/cancelar` a `CuentaEliminacionController` (mismo archivo de T005). Depende de T009.
- [X] T011 [US2] Crear `apps/web/src/pages/EliminacionProgramada.tsx`: al detectar (vía `GET /cuenta/eliminacion`) que la cuenta tiene una eliminación programada, mostrar esta pantalla en vez de la app normal, con la fecha de purga y la acción "Cancelar eliminación"; conectar en la unión de vistas de `apps/web/src/App.tsx` y en el flujo post-login. Depende de T010.
- [X] T012 [US2] Correr los tests de T008, confirmar GREEN.

**Checkpoint**: US1 y US2 funcionan juntas — borrar y revertir, sin pérdida de datos.

---

## Phase 5: User Story 3 - Purga real a los 30 días (Priority: P2)

**Goal**: sin intervención manual, una cuenta vencida queda físicamente purgada — archivos, facturas y registro de usuario destruidos de forma irreversible.

**Independent Test**: `quickstart.md` § Escenario 3.

### Tests for User Story 3 ⚠️

- [X] T013 [P] [US3] Crear `apps/api/test/purga-cuentas-eliminadas.e2e-spec.ts`: sembrar un `User` con `eliminacionProgramadaPara` en el pasado y una `Factura` con archivo real en disco; ejecutar el comando de purga; confirmar que el archivo ya no existe, la `Factura` ya no existe, y `prisma.user.findUnique` devuelve `null`. Correr el comando una segunda vez sobre el mismo estado y confirmar que no falla ni cambia nada (FR-010).

### Implementation for User Story 3

- [X] T014 [P] [US3] Agregar `borrarArchivo(ruta)` (idempotente: un archivo ya inexistente cuenta como éxito) y `listarArchivosDeUsuario(usuarioId)` a `FileStorageService` (`apps/api/src/modules/invoices/file-storage.service.ts`).
- [X] T015 [US3] Crear el comando standalone `apps/api/src/scripts/purgar-cuentas-eliminadas.ts` (`NestFactory.createApplicationContext(AppModule)`): selecciona `User` con `eliminacionProgramadaPara <= now()`; por cada uno, dentro de `aislarPorUsuario`, borra sus archivos (T014), `prisma.factura.deleteMany`, `prisma.user.delete` (D5); log estructurado por cuenta purgada. Depende de T014.
- [X] T016 [US3] Crear `scripts/purgar-cuentas-eliminadas.sh` (mismo molde que `scripts/backup-db.sh`), que invoca el comando compilado dentro del contenedor `api`. Depende de T015.
- [X] T017 [US3] Documentar el cron diario nuevo junto al cron de backup existente en `README.md` § Despliegue (D4 en `research.md`). Depende de T016.
- [X] T018 [US3] Correr el test de T013, confirmar GREEN.

**Checkpoint**: las tres historias funcionan juntas — borrar, revertir, y purgar de verdad al vencer el plazo.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T019 [P] Correr `pnpm typecheck` y `pnpm lint` en todo el monorepo, confirmar limpios. Limpios en `@myivo/api`, `@myivo/web` y `@myivo/domain` — incluyó corregir un error de lint real en `GlobalExceptionFilter` (destructuring con bindings sin usar).
- [X] T020 Validado por la suite automatizada (`pnpm --filter @myivo/api test`, 14/14 en verde, los 3 archivos `*.e2e-spec.ts` incluido el existente de aislamiento entre cuentas) — cubre exactamente los 3 escenarios de `quickstart.md` con aserciones programáticas. **No se corrió contra el `docker compose up` completo (api+web+caddy)** — mismo matiz que T046 de specs/007: Postgres real vía podman local, no el stack entero empaquetado. Sigue pendiente confirmar contra ese stack completo (o un VPS real) antes de publicar.

---

## Dependencies & Execution Order

- **Setup (T001)**: sin dependencias.
- **Foundational (T002)**: depende de T001 — bloquea US1 y US2 (no bloquea US3, que no toca el guard).
- **US1 (T003-T007)**: depende de Foundational.
- **US2 (T008-T012)**: depende de Foundational y reutiliza los archivos de US1 (T004/T005) — no es independiente a nivel de archivo, pero sí a nivel de comportamiento (puede probarse y entregarse por separado una vez que US1 ya está).
- **US3 (T013-T018)**: depende solo de T001 (el campo `eliminacionProgramadaPara` que selecciona candidatos) — NO depende de T002 (el guard) ni de US1/US2 a nivel de código, aunque sin US1 no hay ninguna cuenta real que purgar. Puede implementarse en paralelo a US1/US2 por un segundo desarrollador.
- **Polish (T019-T020)**: depende de que US1, US2 y US3 estén completas.

## Parallel Example

```text
# Tras Foundational, en paralelo:
Developer A: T003 → T004 → T005 → T006 → T007   (US1)
Developer B: T013 [P] → T014 [P] → T015 → T016 → T017 → T018   (US3, no depende de US1/US2 a nivel de código)

# US2 (T008-T012) espera a que US1 termine (mismos archivos T004/T005/CuentaPropia-adjacent).
```

## Implementation Strategy

### MVP primero (US1 únicamente)

1. T001 → T002 (Setup + Foundational).
2. T003-T007 (US1).
3. **Validar de forma independiente** con `quickstart.md` § Escenario 1 — ya cumple el requisito mínimo de Apple Guideline 5.1.1(v) (borrado real, no desactivación).

### Entrega incremental

1. Setup + Foundational.
2. US1 → validar → es ya un MVP viable para el requisito de Apple.
3. US2 → validar → agrega la red de seguridad de reversión.
4. US3 → validar → hace la purga real (sin esto, US1/US2 son "borrado" cosmético — no alcanza para habeas data ni para Apple a largo plazo, igual que una desactivación).
5. Polish.

## Notes

- Commits reales: `docs: amend constitution to v2.1.0` (Principio I), `feat: ... (US1+US2)` (Setup+Foundational+US1+US2 juntos — comparten los mismos archivos de `CuentaEliminacionService`/`Controller`, separarlos habría sido granularidad falsa), `feat: ... (US3)` (archivos nuevos propios: `purga-cuentas/`, script, wrapper de shell, README).
- RED confirmado antes de implementar en US1 y US2 (T003→T004-T006, T008→T009-T011). **Desvío en US3**: el servicio de purga y sus tests (T013-T016) se escribieron juntos en vez de RED-primero estricto — la forma del servicio (orden archivos→Facturas→User, dónde vive `FileStorageService.borrarArchivo`) se decidió recién al escribir el código. Igual se corrió con GREEN real contra una cuenta y un archivo de verdad en disco, incluyendo el caso de idempotencia (T013, segundo caso) — no es una aserción trivial.
- Entorno local: esta sesión corrió contra Postgres bajo **podman** (no Docker Desktop), puerto host remapeado a 5433 vía `docker-compose.override.yml` (gitignored, no versionado) porque otro proyecto (ComandeR) ya ocupaba 5432 en esta máquina. El `docker-compose.yml` versionado —el que corre en el VPS real— no cambió.
- `Factura.usuarioId` sigue sin `onDelete: Cascade` (D5) — no "arreglar" eso como parte de esta feature, es deliberado.
