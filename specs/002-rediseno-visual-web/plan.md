# Implementation Plan: Rediseño visual — temas Industry/Nocturne

**Branch**: `002-rediseno-visual-web` | **Date**: 2026-07-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-rediseno-visual-web/spec.md`

## Summary

Rediseño visual de la app web existente (`apps/web`) sobre un sistema de diseño de alta fidelidad ya validado con el usuario: dos temas intercambiables (Industry claro, Nocturne oscuro) aplicados a las 5 pantallas de la app, sin tocar la lógica de negocio ya implementada (clasificación tributaria, elegibilidad, duplicados, filtros). Además, completa dos requisitos que ya estaban aprobados en la especificación 001 pero nunca se construyeron: eliminar factura (soft-delete sin purga automática, FR-029) y detección de varias facturas en una foto (FR-028).

**Entrega incremental**: mismo acuerdo que la feature 001 — cada historia de usuario (P1→P5) se construye, valida end-to-end, y se da por completa antes de avanzar a la siguiente. `/speckit-tasks` organiza las tareas por fase y `/speckit-implement` se invoca acotado a una fase a la vez.

## Technical Context

**Language/Version**: TypeScript 5.x en modo estricto (Node.js 22 LTS) — sin cambios respecto a la feature 001.

**Primary Dependencies**: React 19 + Vite (ya existente en `apps/web`, sin librería de UI/estilos); NestJS + Prisma (ya existentes en `apps/api`, extendidos con dos capacidades nuevas: soft-delete y un valor nuevo en la máquina de estados). **Sin dependencias nuevas de librería de UI o CSS-in-JS** — los dos temas se implementan con CSS puro (variables CSS + un `data-theme` en el elemento raíz), decisión explícita del usuario para no introducir una dependencia que el proyecto no tiene hoy.

**Storage**: PostgreSQL (sin cambios de motor); se extiende `Factura` con `eliminadaEn` (timestamp nullable, ya previsto en `data-model.md` de la feature 001 pero nunca materializado) y se agrega `varias_facturas` al enum `FacturaEstado`.

**Testing**: Jest para las reglas de dominio nuevas (transición de estado `procesando → varias_facturas`, filtrado de facturas eliminadas) — mismo patrón que la feature 001. Sin tests de snapshot visual (fuera de alcance; validación visual es por inspección manual contra el diseño de referencia, ver `research.md`).

**Target Platform**: Misma app web servida hoy (navegador móvil vía Caddy/VPS) — se descarta explícitamente una app nativa (ver spec.md § Assumptions).

**Project Type**: Web application (backend + frontend) en el mismo monorepo pnpm + Turborepo ya existente.

**Performance Goals**: El cambio de tema MUST reflejarse de inmediato (SC-002) sin recargar datos ni parpadeo perceptible — implica que los tokens de tema deben resolverse por CSS puro (cambio de atributo), no por remontar componentes React.

**Constraints**: Cero telemetría a terceros (constitution Principio VII) — las tipografías de ambos temas (Barlow, Barlow Condensed, Inter) se auto-hospedan como archivos estáticos servidos por la propia app, en vez de referenciar Google Fonts u otro CDN externo en cada carga de página (ver `research.md` § 1). Costo operativo sin cambios (no se agrega infraestructura nueva).

**Scale/Scope**: Sin cambios respecto a 001 — un único usuario. 5 historias de usuario, 13 requisitos funcionales nuevos (FR-001 a FR-013 de esta feature).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Cómo se cumple |
|---|---|---|
| I. Inmutabilidad de la Evidencia | PASS | El soft-delete (US2) es exactamente el mecanismo que este principio ya exige y la feature 001 dejó sin construir: "el registro se marca, los archivos permanecen recuperables" — FR-009 lo implementa al pie de la letra, incluyendo que ningún proceso automático purga nada |
| II. Exactitud Monetaria | N/A esta fase | Esta feature no introduce ni modifica ningún cálculo monetario — solo su presentación visual (ya validada contra la lógica existente) |
| III. Desconfianza por Defecto en la Extracción por IA | PASS | La señal "esta imagen contiene varias facturas" (US3) es una hipótesis más del mismo `InvoiceExtractor` — se añade al mismo schema Zod de validación (`ExtractedInvoiceData`) que ya frontera entre el proveedor y el dominio; no se persiste ningún campo extraído si la señal es positiva (FR-010) |
| IV. Clasificación Tributaria Explícita y Versionada | N/A esta fase | No se toca ninguna regla tributaria ni de elegibilidad — el banner de elegibilidad (US1) solo refleja visualmente el cálculo ya existente |
| V. Arquitectura Hexagonal | PASS | El nuevo valor de estado vive en `packages/domain` (máquina de estados pura, sin dependencias de framework); el soft-delete se filtra en la capa de repositorio (`apps/api`), nunca en el dominio; el sistema de temas es 100% `apps/web`, no cruza hacia el dominio |
| VI. Validación DIAN sin Trampas | N/A esta fase | Sin relación con esta feature |
| VII. Privacidad y Soberanía Operativa | PASS | Cero dependencias nuevas de terceros en runtime; las tipografías se auto-hospedan (ver `research.md` § 1) en vez de cargarse desde un CDN de fuentes, evitando una fuga de telemetría (IP del usuario) a un tercero en cada carga de página; sin cambios de infraestructura ni de costo |
| VIII. Calidad Verificable | PASS | La nueva transición de estado (`procesando → varias_facturas`) y el filtrado de facturas eliminadas en las consultas del repositorio llevan test unitario de dominio, siguiendo el mismo patrón ya establecido en `packages/domain/test/state-machine.spec.ts` |

No hay violaciones — la sección de Complexity Tracking queda vacía.

**Re-evaluación post-diseño (Fase 1)**: confirmada tras completar `data-model.md` y `contracts/` — el nuevo campo `eliminadaEn` y el valor `varias_facturas` se modelan como extensiones directas de las entidades ya existentes de la feature 001 (mismo patrón, misma ubicación), sin introducir ninguna entidad ni dependencia nueva. Constitution Check se mantiene en PASS.

## Project Structure

### Documentation (this feature)

```text
specs/002-rediseno-visual-web/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
packages/domain/src/
├── state-machine/
│   └── factura-estado.ts          # + valor "varias_facturas" y su transición desde "procesando"
├── ports/
│   └── invoice-extractor.port.ts  # + campo de señal "múltiples documentos" en ExtractedInvoiceData
└── entities/
    └── factura.ts                 # + campo eliminadaEn (Date | null)

apps/api/
├── prisma/
│   ├── schema.prisma               # + valor de enum FacturaEstado, + columna eliminadaEn
│   └── migrations/                 # nueva migración
└── src/modules/
    ├── extraction/
    │   ├── extraction-prompt.ts    # + instrucción sobre múltiples documentos
    │   └── extraction.processor.ts # + rama: transicionar a varias_facturas sin persistir campos
    └── invoices/
        ├── factura.repository.ts   # + exclusión de eliminadaEn en listar()/obtenerPorId(); + método eliminar()
        └── invoices.controller.ts  # + endpoint de eliminar (no usa el verbo HTTP DELETE, ver contracts/api.md)

apps/web/src/
├── theme/                          # NUEVO — tokens CSS de ambos temas + selector + persistencia
│   ├── tokens.css                  # variables CSS por tema (Industry/Nocturne), vía [data-theme]
│   ├── fonts/                      # tipografías auto-hospedadas (Barlow, Barlow Condensed, Inter)
│   └── useTheme.ts                 # hook: lee/persiste preferencia, aplica data-theme en <html>
├── pages/
│   ├── Captura.tsx                 # + 6to estado visual "varias facturas"
│   ├── Detalle.tsx                 # + menú "···" con Eliminar; + campo tipo de documento visible
│   ├── Listado.tsx                 # + badge de moneda distinta a COP; + pantalla de estado vacío
│   └── EstadoVacio.tsx             # NUEVO
└── App.tsx                         # + selector de tema accesible desde cualquier pantalla
```

**Structure Decision**: Se reutiliza exactamente la estructura de monorepo ya establecida en la feature 001 (`packages/domain`, `apps/api`, `apps/web`) — esta feature no introduce ningún paquete, servicio ni carpeta de nivel superior nueva, solo extiende archivos existentes y agrega un módulo `theme/` y una página `EstadoVacio.tsx` dentro de `apps/web/src`.

## Complexity Tracking

*Sin violaciones — sección vacía.*
