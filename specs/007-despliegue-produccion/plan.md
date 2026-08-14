# Implementation Plan: Despliegue en Producción

**Branch**: `007-despliegue-produccion` | **Date**: 2026-08-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-despliegue-produccion/spec.md`

## Summary

MyIvo hoy corre en desarrollo: `docker-compose.yml` solo levanta Postgres, la API corre con `node dist/main.js` fuera de Docker, y `Caddyfile` es un esqueleto sin los servicios `api`/`web` conectados. Esta feature no agrega funcionalidad de negocio — cierra la brecha entre "funciona en mi máquina" y "puedo confiar en esto todos los días desde el celular, en la calle": un `docker compose up` reproducible con HTTPS automático, sesión que sobrevive redespliegues, procesamiento de lotes que no se satura a sí mismo, recuperación automática de facturas atascadas al reiniciar, respaldo cifrado fuera del servidor con restauración ya probada, y la corrección de un bug real de rango numérico (`Int` de Postgres se desborda a los ~21,4 millones de COP en centavos).

La investigación (research.md) encontró que la mayoría de estos requisitos se resuelven extendiendo mecanismos que YA existen en el código (el limitador de tasa de inicio de sesión de Better Auth, la máquina de estados de `Factura`, el script de respaldo, el propio esqueleto de Caddy/compose) en vez de introducir infraestructura nueva — consistente con el techo de <15 USD/mes y "sin servicios adicionales" del Principio VII.

## Technical Context

**Language/Version**: TypeScript ~6.0.3 (`strict`, `NodeNext`), Node.js ≥22. Monorepo pnpm 10.14.0 + Turborepo 2.10.7 (`apps/api`, `apps/web`, `packages/domain`).

**Primary Dependencies**: NestJS 11 + Prisma 7.9 (`@prisma/adapter-pg`, driver adapters) en `apps/api`; Better Auth 1.6.25 (+ `@better-auth/passkey`, `two-factor`) ya maneja sesión/login social/passkeys/2FA; Zod 4 para validación (incluida `env.schema.ts`); React 19 + Vite 8 en `apps/web`; Caddy para TLS automático (`Caddyfile` ya existe, incompleto).

**Storage**: PostgreSQL 17 (`postgres:17-alpine`, ya en `docker-compose.yml`) — nunca expuesta fuera del propio VPS (FR-004, ya así en el compose actual: `127.0.0.1:5432:5432`). Imágenes originales en filesystem bajo `IMAGE_STORAGE_PATH`, destinadas al volumen Docker `invoice_images` (ya declarado en `docker-compose.yml`, sin montar todavía porque el servicio `api` no existe ahí aún).

**Testing**: Jest (`apps/api`), tests unitarios de `packages/domain` (los únicos que corren hoy en CI — `.github/workflows/ci.yml` excluye deliberadamente el e2e de aislamiento RLS de `apps/api` por necesitar Postgres real + `RESEND_API_KEY`). Esta feature no cambia esa estrategia; ver research.md para qué queda cubierto por test unitario vs. verificación manual del quickstart.

**Target Platform**: VPS Linux único (1 vCPU / 1-2 GB RAM), Docker Compose, Caddy como capa pública con HTTPS automático (Let's Encrypt vía ACME).

**Project Type**: Aplicación web existente (backend NestJS + SPA React) — esta feature no agrega una aplicación nueva, opera la que ya existe.

**Performance Goals**: SC-001 (≤15 min de un VPS limpio a HTTPS accesible siguiendo el quickstart); SC-002 (lote de 80 archivos, 100% en estado final, ninguno fallido por saturación propia); SC-007 (listado/filtros en tiempo percibido como instantáneo con miles de facturas de varios años).

**Constraints**: Principio VII (autoalojado, cero telemetría a terceros, <15 USD/mes total incluyendo el proveedor de respaldo externo); Principio I (ninguna operación de esta feature — respaldo, recuperación al arranque, migración de `Int`→`BigInt` — puede sobrescribir o perder un original); Principio II (la corrección de rango numérico no puede introducir `float`/pérdida de precisión); la base de datos ya gestionada (Postgres autoalojado) no cambia — decisión ya tomada explícitamente con el usuario esta sesión, fuera de alcance reabrirla aquí.

**Scale/Scope**: Instancia autoalojada multi-cuenta (Better Auth + RLS por `usuarioId` ya implementados en `specs/006-multi-usuario`); escala real objetivo = miles de facturas por cuenta acumuladas en varios años (FR-025), lote de 80 archivos como escenario de estrés concreto (US3).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación | Cómo lo cumple esta feature |
|---|---|---|
| I. Inmutabilidad de la Evidencia | PASS | Las imágenes siguen en el volumen `invoice_images`, nunca sobrescritas; el respaldo (US5) es una copia adicional, no un reemplazo del mecanismo de guardado (`FileStorageService.guardarOriginal` ya usa `flag: 'wx'`, sin tocar). La migración `Int`→`BigInt` (US6) es un `ALTER COLUMN TYPE` sin pérdida — `bigint` es superconjunto de `int4`. |
| II. Exactitud Monetaria | PASS (corrige un bug existente) | `Int` (4 bytes, tope 21.474.836,47 COP en centavos) → `BigInt` (8 bytes) en las 6 columnas monetarias de `Factura`/`ItemFactura`. Nunca se introduce `float`: la conversión JS se hace con `BigInt`/`Number` exactos en la frontera del repositorio (research.md § Precisión Monetaria), nunca con división/redondeo. |
| III. Desconfianza en Extracción IA | PASS, sin cambios | El limitador de concurrencia (US3) envuelve la invocación al extractor, no toca la validación Zod ni el flujo `extraction_failed`. |
| IV. Clasificación Tributaria Versionada | PASS, sin cambios | Ninguna regla tributaria se toca en esta feature. |
| V. Arquitectura Hexagonal | PASS | El límite de concurrencia y la recuperación al arranque viven en `apps/api` (infraestructura); `packages/domain` no gana ninguna dependencia nueva. La conversión `BigInt`↔`number` queda contenida en `factura.repository.ts` — el dominio sigue viendo `number`, sin saber que Postgres usa `bigint`. |
| VI. Validación DIAN sin Trampas | PASS, sin cambios | Fuera del alcance de esta feature. |
| VII. Privacidad y Soberanía Operativa | PASS, es el objetivo central | Todo autoalojado (Postgres + imágenes en el propio VPS, decisión ya ratificada esta sesión); el único dato que sale del servidor es el respaldo cifrado (FR-018/018a) — la llave vive en dos lugares controlados por el usuario, nunca solo en el servidor. Costo total (VPS + almacenamiento de objetos de centavos/GB + LLM) se mantiene muy por debajo de 15 USD/mes (research.md § Costo). |
| VIII. Calidad Verificable | PASS | La recuperación al arranque (US4) reutiliza exclusivamente transiciones ya definidas (`procesando → fallida`, ya usada por el propio manejo de errores de `ExtractionProcessor`) — cero transiciones nuevas. Cobertura pragmática en infraestructura (limitador de concurrencia, Dockerfiles) vs. tests unitarios obligatorios donde hay lógica de dominio nueva (ninguna en esta feature — es puramente operacional). |

Sin violaciones. Tabla de Complexity Tracking vacía a propósito: research.md descarta explícitamente cada pieza de infraestructura nueva que se consideró y no se justificó (Redis/BullMQ, un rol Postgres `BYPASSRLS` aparte, un motor de búsqueda de texto completo, un contenedor Node aparte solo para servir el SPA) — ver research.md § Alternativas descartadas en cada decisión.

### Re-chequeo post-Fase 1

Tras research.md y data-model.md, ninguna decisión de diseño concreta introduce una violación nueva ni obliga a revisar la tabla de arriba:

- La migración `Int → BigInt` (data-model.md § 1) queda contenida en `factura.repository.ts` — no filtra `bigint` nativo hacia `packages/domain` (Principio V intacto).
- Los dos "Key Entities" del spec (Respaldo, Evento de recuperación al arranque) se resolvieron explícitamente **sin** tablas nuevas (data-model.md) — cero superficie de esquema no justificada por un FR.
- `age`/`rclone` son binarios sin estado ni servicio propio que administrar — no reabren el techo de costo ni la cláusula "sin servicios adicionales" del Principio VII. El limitador de concurrencia de US3 terminó siendo código propio, no una librería (`p-limit` se descartó durante la implementación — ESM-only, rompía los tests bajo Jest; research.md § 4).
- La recuperación al arranque (US4) sigue usando exclusivamente `procesando → fallida`, ya validado como transición existente antes de escribir research.md — no se descubrió necesidad de ninguna transición nueva durante el diseño.

Constitution Check se mantiene en PASS sin cambios respecto a la evaluación pre-Fase 0.

## Project Structure

### Documentation (this feature)

```text
specs/007-despliegue-produccion/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── health.md
│   ├── env-vars.md
│   └── backup-restore.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
Dockerfile.api                        # NUEVO — build multi-stage de apps/api (node:22-bookworm-slim)
Dockerfile.web                        # NUEVO — build de apps/web (vite build); su salida se copia a /srv/web
docker-compose.yml                    # + servicios api, web (build-only o caddy), caddy; monta invoice_images en api
Caddyfile                             # FIX: handle_path /api/* (hoy no quita el prefijo antes del reverse_proxy)
scripts/
├── backup-db.sh                      # EXTENDER: + tar de invoice_images, + cifrado (age), + subida (rclone → B2)
└── restore.sh                        # NUEVO — procedimiento de restauración documentado y probado (FR-020)

apps/api/
├── prisma/
│   ├── schema.prisma                 # Int → BigInt (6 columnas monetarias) + nuevos índices (usuarioId, cufe, gin trgm)
│   └── migrations/                   # nueva migración generada por Prisma
├── src/
│   ├── main.ts                       # + app.set('trust proxy', 1)
│   ├── app.controller.ts             # health endpoint: + estado de la conexión a BD (FR-027) + último respaldo (FR-021)
│   ├── app.module.ts                 # + hook de arranque (recuperación de facturas atascadas, US4)
│   ├── config/env.schema.ts          # + límites de subida, concurrencia de extracción, config de respaldo
│   ├── modules/
│   │   ├── auth/auth.ts              # + rateLimit.customRules para /sign-in/email, advanced.ipAddress
│   │   ├── invoices/
│   │   │   ├── invoices.module.ts    # MulterModule.registerAsync — límites de tamaño/cantidad (FR-012/013)
│   │   │   └── factura.repository.ts # frontera BigInt↔number (aDominio, obtenerItems, agregados)
│   │   ├── extraction/
│   │   │   └── extraction.module.ts  # + limitador de concurrencia (limitador-concurrencia.ts, sin librería externa) alrededor del despacho (FR-011)
│   │   └── arranque/                 # NUEVO módulo — recuperación de facturas "procesando" al iniciar (US4)
│   └── ...
└── ...

apps/web/                             # sin cambios de negocio; FR-014 ya cubierto por la pantalla de Captura existente
```

**Structure Decision**: Se mantiene la estructura de monorepo ya existente (`apps/api`, `apps/web`, `packages/domain`). No se introduce ningún paquete ni servicio nuevo — los únicos artefactos nuevos son de despliegue (`Dockerfile.api`, `Dockerfile.web`, `scripts/restore.sh`) y un módulo pequeño de arranque dentro de `apps/api`. Ningún cambio toca `apps/web` a nivel de código de negocio: la visibilidad de progreso de lote (FR-014) ya la cubre la pantalla de Captura existente (research.md lo confirma antes de proponer trabajo nuevo).

## Complexity Tracking

> Sin violaciones que justificar — tabla vacía a propósito (ver Constitution Check arriba).
