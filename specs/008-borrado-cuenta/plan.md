# Implementation Plan: Borrado de Cuenta con Purga Diferida

**Branch**: `001-captura-facturas` (rama troncal real del proyecto — ver nota abajo) | **Date**: 2026-10-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/008-borrado-cuenta/spec.md`

**Nota sobre la rama**: `main` solo tiene el commit de inicialización del repo; todo el trabajo
real (specs 001-007, ya implementadas) vive en `001-captura-facturas`, que en los hechos es la
rama troncal del proyecto pese a su nombre numerado. Crear una rama `008-borrado-cuenta` desde
`main` perdería ese historial — se sigue trabajando sobre `001-captura-facturas`.

## Summary

Borrado de cuenta in-app requerido por App Store Review Guideline 5.1.1(v) y por habeas data
básico: la cuenta queda inaccesible al instante al confirmarse, con una ventana de 30 días donde
los datos permanecen intactos y recuperables, y purga física irreversible automática al vencer el
plazo sin reversión. Enfoque técnico: el endpoint propio NO usa el borrado nativo (inmediato y
duro) de Better Auth; marca dos campos nuevos en `User` y revoca sesiones al instante, mientras un
comando standalone de Nest —disparado por cron del sistema operativo, mismo patrón que el backup
de specs/007— ejecuta la purga real día 30, en el orden archivos→Facturas→User que no viola la FK
existente (`Factura.usuarioId` sin `onDelete: Cascade`, deliberado).

## Technical Context

**Language/Version**: TypeScript ~6.0.3 (strict), Node >=22

**Primary Dependencies**: NestJS 11, Prisma 7.9.1 + `@prisma/adapter-pg`, Better Auth 1.6.25,
`nestjs-cls` + `@nestjs-cls/transactional` (aislamiento por `aislarPorUsuario`) — todas ya en el
monorepo, ninguna dependencia nueva.

**Storage**: PostgreSQL 17 (dos columnas nuevas en `User`, sin tablas nuevas); filesystem local
para archivos (vía `FileStorageService`, al que se le agregan métodos de borrado físico).

**Testing**: Jest + supertest, mismo patrón de `apps/api/test/aislamiento-cuentas.e2e-spec.ts`
(bootstrap real de Nest + Better Auth montado) — es la única excepción existente a "sin tests en
apps/api" (constitution Principio VIII / aislamiento entre cuentas), y este feature la extiende
porque también es un caso de aislamiento/integridad de datos entre cuentas no negociable.

**Target Platform**: Igual que el resto de `apps/api` — contenedor Docker en un VPS pequeño.

**Project Type**: Web (monorepo existente: `apps/api` + `apps/web` + `packages/domain`).

**Performance Goals**: N/A — operación de baja frecuencia (borrado de cuenta, purga diaria sobre
pocos candidatos). Sin requisitos de throughput.

**Constraints**: Cero dependencias nuevas (D4 en `research.md`: seguir el patrón cron+script ya
establecido, no `@nestjs/schedule`). Debe respetar el presupuesto de <15 USD/mes (constitution
Principio VII) — no agrega infraestructura, solo un comando más en el cron ya existente.

**Scale/Scope**: 2 endpoints de negocio + 1 comando standalone + 1 guard extendido + 2 columnas
nuevas + 1 pantalla nueva en `apps/web`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Inmutabilidad de la Evidencia | **Pasa.** Constitution enmendada a 2.1.0 (`.specify/memory/constitution.md`) antes de este plan, agregando la única excepción necesaria: borrado de cuenta iniciado por su titular, con ventana de 30 días. Sin la enmienda, este plan habría violado el principio sin alternativa — no hay "Complexity Tracking" que valga contra un Principio Core (Governance: "gana el principio o se enmienda la constitution — no hay tercera vía"). |
| II. Exactitud Monetaria | No aplica — esta feature no toca valores monetarios. |
| III. Desconfianza por Defecto en la Extracción | No aplica — no toca el pipeline de extracción. |
| IV. Clasificación Tributaria | No aplica. |
| V. Arquitectura Hexagonal | **Pasa.** Los campos nuevos y el guard extendido viven en `apps/api` (NestJS/Prisma), no en `packages/domain` — no hay regla tributaria ni de dominio puro involucrada en "cuándo purgar una cuenta", es infraestructura de auth/storage. |
| VI. Validación DIAN | No aplica. |
| VII. Privacidad y Soberanía Operativa | **Pasa, y la refuerza.** Habeas data es exactamente el espíritu de este principio; la purga real es más alineada con "los datos son del usuario" que dejarlos indefinidamente tras un "borrado" cosmético. Cero dependencias/infraestructura nueva — presupuesto intacto. |
| VIII. Calidad Verificable | **Pasa.** El comando de purga y el guard extendido son código de infraestructura con reglas de negocio claras (idempotencia, orden de operaciones) — se cubren con el mismo patrón de test e2e de aislamiento ya existente, extendido (ver Testing arriba). No hay regla de *dominio* nueva que exija un test unitario en `packages/domain` (esta feature no toca ese paquete). |

Sin violaciones pendientes. **Complexity Tracking: vacío** (no quedó ninguna violación por
justificar — la única que existía se resolvió con la enmienda de constitution, no con una excepción
de complejidad).

## Project Structure

### Documentation (this feature)

```text
specs/008-borrado-cuenta/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── cuenta-eliminacion.md
└── tasks.md             # Phase 2 output (/speckit-tasks — not created by this command)
```

### Source Code (repository root)

```text
apps/api/
├── prisma/
│   └── schema.prisma                           # +2 campos en User (eliminacionSolicitadaEn, eliminacionProgramadaPara)
├── src/modules/auth/
│   ├── cuenta-eliminacion.controller.ts         # nuevo — POST/GET/POST cancelar (ver contracts/)
│   ├── cuenta-eliminacion.service.ts            # nuevo — lógica de marcar/cancelar, revocar sesiones
│   └── guards/session-usuario.guard.ts          # extendido — rechaza si eliminacionProgramadaPara no es null
├── src/modules/invoices/
│   └── file-storage.service.ts                  # extendido — +borrarArchivo, +listarArchivosDeUsuario
└── src/scripts/
    └── purgar-cuentas-eliminadas.ts             # nuevo — comando standalone de Nest, invocado por cron

apps/web/
├── src/pages/CuentaPropia.tsx                   # +sección "Eliminar mi cuenta"
└── src/pages/EliminacionProgramada.tsx          # nuevo — pantalla de estado/cancelar (D3)

scripts/
└── purgar-cuentas-eliminadas.sh                 # nuevo — wrapper de shell para el cron, mismo molde que backup-db.sh

apps/api/test/
└── aislamiento-cuentas.e2e-spec.ts              # extendido con los escenarios de esta feature (o un spec hermano, a decidir en tasks)
```

**Structure Decision**: Reutiliza la estructura existente del monorepo; no se crean paquetes ni
apps nuevas. El único archivo verdaderamente nuevo del lado de infraestructura es el comando de
purga (`src/scripts/`, patrón sin precedente directo en `apps/api/src` pero sí en el proyecto vía
`scripts/*.sh`) — todo lo demás extiende módulos ya existentes.

## Complexity Tracking

*(vacío — ver Constitution Check arriba)*
