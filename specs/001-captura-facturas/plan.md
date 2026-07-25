# Implementation Plan: Captura y Registro Estructurado de Facturas

**Branch**: `001-captura-facturas` | **Date**: 2026-07-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-captura-facturas/spec.md`

## Summary

Sistema personal de captura de facturas físicas (foto desde el celular o carga de imágenes existentes) que las convierte en registros estructurados y consultables, clasificados por tipo de documento y marcados con elegibilidad para la deducción tributaria del 1%. La foto original se guarda de inmediato e inmutable; un pipeline asíncrono extrae los campos vía un LLM con visión (validado contra schema estricto), decodifica el CUFE de forma determinística desde el QR, calcula la elegibilidad como función pura del dominio, detecta duplicados, y expone un listado filtrable con el detalle de cada factura junto a su foto original.

**Entrega incremental**: el plan, el modelo de datos y los contratos cubren las 5 historias de usuario de forma arquitectónicamente coherente (mismo esquema hexagonal, mismo modelo de datos), pero la construcción real ocurre en el orden de prioridad del spec — H1 (captura) → H2 (extracción) → H3 (clasificación tributaria) → H4 (consulta) → H5 (duplicados) — cada una entregada y validada end-to-end antes de continuar con la siguiente. `/speckit-tasks` organiza las tareas por esa misma fase, y `/speckit-implement` se invoca acotado a una fase a la vez.

## Technical Context

**Language/Version**: TypeScript 5.x en modo estricto (Node.js 22 LTS), backend y frontend.

**Primary Dependencies**: NestJS (capa de adaptadores HTTP), Prisma sobre PostgreSQL (persistencia), Zod (validación de schema del dominio), `@anthropic-ai/sdk` (adaptador `InvoiceExtractor`, modelo `claude-sonnet-5` con `output_config.format` para salida estructurada), `jsqr` o equivalente (decodificación determinística de CUFE/CUDE desde QR), `sharp` (generación de derivados de imagen), Vite + React (frontend SPA), Caddy (reverse proxy + TLS automático).

**Storage**: PostgreSQL (vía Prisma) para el modelo relacional de facturas/ítems/correcciones/duplicados; imágenes (original + derivados) en el filesystem del VPS, montado como volumen Docker.

**Testing**: Jest para tests unitarios de dominio (reglas tributarias, cuadre monetario, máquina de estados — obligatorios por constitution Principio VIII). Tests de infraestructura/UI son pragmáticos, no obligatorios por spec.

**Target Platform**: Contenedores Docker vía `docker compose` en un VPS Linux pequeño.

**Project Type**: Web application (backend + frontend) en monorepo pnpm + Turborepo.

**Performance Goals**: Sin target de latencia estricto (herramienta personal, un usuario). La UI responde a acciones de captura/listado en <2s bajo condiciones normales de red móvil; la extracción es asíncrona y no bloquea la UI (FR-003/FR-004).

**Constraints**: Costo operativo <15 USD/mes de infraestructura + consumo de LLM (Principio VII — estimado real: <2 USD/mes a este volumen); arquitectura hexagonal estricta, dominio sin dependencias de NestJS/Prisma/SDKs (Principio V); cero telemetría a terceros; HTTPS obligatorio con autenticación de un solo usuario (FR-030); TypeScript estricto en todos los paquetes.

**Scale/Scope**: Un único usuario; backlog inicial estimado de decenas a un par de cientos de facturas históricas (SC-001: al menos 50 por sesión); crecimiento incremental de unas pocas facturas por semana en uso estable. 5 historias de usuario, 30 requisitos funcionales (FR-001 a FR-030).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Cómo se cumple |
|---|---|---|
| I. Inmutabilidad de la Evidencia | PASS | Imagen original en filesystem, nunca sobrescrita por procesos automáticos (FR-005); derivados (compresión/recorte) son archivos nuevos vinculados al original; eliminar un documento es soft-delete explícito (FR-029) |
| II. Exactitud Monetaria | PASS | Prisma con `Decimal`/entero en centavos para todo campo monetario — `Float` prohibido en cualquier capa; moneda explícita por documento (FR-026); descuadre → `necesita_revisión`, nunca corrección silenciosa (FR-010) |
| III. Desconfianza por Defecto en la Extracción por IA | PASS | Adaptador `InvoiceExtractor` detrás de un puerto; JSON crudo del proveedor + versión de prompt/modelo persistidos junto al registro normalizado; validación Zod antes de persistir en el dominio; CUFE por decodificación QR determinística, nunca LLM, con fallback marcado de menor confianza (FR-007/FR-008) |
| IV. Clasificación Tributaria Explícita y Versionada | PASS | Taxonomía de 5 tipos ya fijada (FR-014); elegibilidad como cálculo derivado mediante funciones puras del dominio con tests unitarios obligatorios (FR-015/FR-016/FR-017) |
| V. Arquitectura Hexagonal | PASS | NestJS, Prisma y el SDK de Claude viven solo en la capa de adaptadores; el dominio (`packages/domain`) es TypeScript puro sin esas dependencias; monorepo pnpm + Turborepo |
| VI. Validación DIAN sin Trampas | N/A esta fase | Fuera de alcance explícito de esta funcionalidad (feature 002); ningún adaptador de esta feature interactúa con el portal DIAN |
| VII. Privacidad y Soberanía Operativa | PASS | `docker compose` en VPS propio; cero telemetría a terceros; HTTPS + autenticación de un solo usuario (FR-030); costo LLM estimado <2 USD/mes, muy por debajo del objetivo de <15 USD/mes |
| VIII. Calidad Verificable | PASS | Jest obligatorio para reglas tributarias, cuadre monetario y máquina de estados; máquina de estados explícita y documentada en el dominio |

No hay violaciones — la sección de Complexity Tracking queda vacía.

**Re-evaluación post-diseño (Fase 1)**: confirmada tras completar `data-model.md` y `contracts/` — el modelo de datos no introduce ninguna dependencia del dominio hacia NestJS/Prisma (los tipos de Prisma se mapean a entidades de dominio en la capa de adaptador de persistencia), y todos los campos monetarios en `data-model.md` están tipados como enteros en centavos. Constitution Check se mantiene en PASS.

## Project Structure

### Documentation (this feature)

```text
specs/001-captura-facturas/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/
├── api/                          # NestJS — capa de adaptadores HTTP y persistencia
│   ├── src/
│   │   ├── modules/
│   │   │   ├── invoices/         # controladores, DTOs, repositorio Prisma de Factura/Ítem
│   │   │   ├── auth/             # sesión de un solo usuario (FR-030)
│   │   │   └── extraction/       # adaptador InvoiceExtractor (Claude API) + decodificador QR/CUFE
│   │   ├── prisma/                # schema.prisma, migraciones
│   │   └── main.ts
│   └── test/                      # tests de integración de adaptadores (pragmáticos)
│
├── web/                           # Vite + React — SPA de captura, listado/filtro y detalle
│   ├── src/
│   │   ├── pages/                 # Captura, Listado, Detalle
│   │   ├── components/
│   │   └── services/              # cliente HTTP hacia apps/api
│   └── test/
│
packages/
└── domain/                        # dominio puro — sin NestJS/Prisma/SDKs
    ├── src/
    │   ├── entities/               # Factura, ÍtemFactura, CorrecciónManual, MarcaDePosibleDuplicado
    │   ├── state-machine/          # máquina de estados del documento
    │   ├── tax-rules/              # elegibilidad tributaria, versionada por año gravable
    │   └── ports/                  # InvoiceExtractor (puerto)
    └── test/                       # tests unitarios obligatorios (Jest) — reglas de dominio
```

**Structure Decision**: Monorepo pnpm + Turborepo con dos apps (`apps/api` en NestJS, `apps/web` en Vite+React) y un paquete de dominio compartido (`packages/domain`) sin dependencias de infraestructura, siguiendo la arquitectura hexagonal exigida por el Principio V. El puerto `InvoiceExtractor` vive en `packages/domain/src/ports`; su único adaptador en esta feature es `apps/api/src/modules/extraction` (Claude API + decodificador QR). El puerto `DianValidator` mencionado en la constitution no se crea todavía — pertenece a la feature 002, fuera de alcance aquí.

## Complexity Tracking

*(vacío — no hay violaciones del Constitution Check que justificar)*
