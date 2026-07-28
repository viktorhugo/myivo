# Implementation Plan: Validación y conciliación contra la DIAN

**Branch**: `003-validacion-dian` | **Date**: 2026-07-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-validacion-dian/spec.md`

## Summary

Permitir que el usuario confirme el CUFE de una factura contra la fuente oficial de la DIAN, de forma asistida (nunca automatizada): un enlace al catálogo de la DIAN con el CUFE precargado (`?documentkey=`), donde el usuario registra manualmente el resultado que vio (US1); y una conciliación en lote contra el Excel de documentos recibidos que el propio usuario descarga de su portal DIAN (US2). Ambas rutas alimentan la misma entidad nueva `ValidacionDian`, append-only, sin modificar ningún dato ya calculado por la feature 001 (clasificación, elegibilidad).

## Technical Context

**Language/Version**: TypeScript en modo estricto (Node.js 22 LTS backend, React 19 frontend) — mismo stack de 001/002, sin cambios.

**Primary Dependencies**: NestJS + Prisma (backend, ya existentes); `exceljs` (nueva — parseo del Excel de conciliación, ver research.md § 4); React + Vite (frontend, ya existente).

**Storage**: PostgreSQL — nueva tabla `validaciones_dian`, relacionada con `facturas` ya existente.

**Testing**: Jest en `packages/domain` para cualquier regla de negocio nueva (constitution Principio VIII) — mismo criterio pragmático que 001/002: sin tests de contrato/integración nuevos en `apps/api` más allá de eso.

**Target Platform**: Web — misma SPA + API ya desplegadas.

**Project Type**: Web application (monorepo ya existente: `apps/api`, `apps/web`, `packages/domain`).

**Performance Goals**: N/A específico — operación de un solo usuario, bajo volumen (backlog personal de facturas, no un sistema multiusuario de alto tráfico).

**Constraints**: Cero automatización o scraping del portal de la DIAN (constitution Principio VI) — toda interacción con la DIAN ocurre en el navegador del usuario, fuera del control del backend.

**Scale/Scope**: 2 User Stories (P1 validación individual, P2 conciliación en lote), una entidad de dominio nueva, sin cambios a entidades existentes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Inmutabilidad de la Evidencia | N/A — esta feature no toca imágenes originales ni sus derivados. |
| II. Exactitud Monetaria | PASS — el snapshot de `ValidacionDian` copia `totalCentavos` tal cual ya está en `Factura` (entero, con su moneda); no se recalcula ni convierte nada. |
| III. Desconfianza por Defecto en la Extracción por IA | N/A directo (esta feature no usa ningún LLM/OCR) — pero el mismo espíritu se aplica al Excel de conciliación: es entrada externa no confiable, se parsea con validación estricta y se rechaza explícitamente si no se puede interpretar (FR-009), nunca se "adivina" una columna. |
| IV. Clasificación Tributaria Explícita y Versionada | PASS — `ValidacionDian` es información complementaria de auditoría; MUST NOT escribir ni recalcular `elegibilidadTributaria`/`tipoDocumento`, que siguen siendo calculados exclusivamente por las reglas ya existentes de la feature 001. |
| V. Arquitectura Hexagonal | PASS — el tipo `ValidacionDian`, el enum de resultado, y la función que decide si el Excel de conciliación coincide con una factura (comparación de CUFE) viven en `packages/domain`, sin importar Prisma/NestJS. |
| VI. Validación DIAN sin Trampas | PASS explícito — es el principio que esta feature existe para cumplir; ver research.md § 1 y spec.md FR-002. Ningún request HTTP del backend llega jamás al dominio `dian.gov.co`. |
| VII. Privacidad y Soberanía Operativa | PASS — el Excel de conciliación se procesa en el propio backend del usuario, nunca se reenvía a un tercero; sin telemetría nueva. |
| VIII. Calidad Verificable | PASS — la función de conciliación (¿qué CUFEs del Excel coinciden con qué facturas?) es una regla de dominio pura, con test unitario obligatorio. |

**Re-check post Phase 1** (tras `data-model.md` y `contracts/api.md`): sin cambios respecto a la evaluación inicial. El diseño detallado confirma explícitamente que `ValidacionDian` nunca escribe sobre `Factura` (data-model.md § Validaciones de dominio) y que ningún endpoint nuevo llama a la DIAN (contracts/api.md — el enlace se construye enteramente en el frontend). Gate: PASS.

Sin violaciones — no se requiere Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
packages/domain/
├── src/
│   ├── entities/validacion-dian.ts        # ValidacionDian, ResultadoValidacionDian, MetodoValidacionDian
│   └── rules/conciliacion-dian.ts         # función pura: ¿qué facturas coinciden con los CUFEs de un Excel?
└── test/
    └── conciliacion-dian.spec.ts

apps/api/
├── prisma/schema.prisma                   # + model ValidacionDian (relación a Factura)
└── src/modules/validacion-dian/           # módulo nuevo, depende de modules/invoices (mismo patrón que modules/extraction)
    ├── validacion-dian.module.ts
    ├── validacion-dian.controller.ts      # POST validar manual, POST conciliar (upload .xlsx), GET historial
    ├── validacion-dian.repository.ts
    └── conciliacion-excel.service.ts      # parseo del .xlsx con exceljs (research.md § 3-4)

apps/web/
└── src/
    ├── services/validacion-dian.ts        # cliente HTTP nuevo
    ├── pages/Detalle.tsx                  # + sección de validación DIAN (enlace, registrar resultado, historial)
    ├── pages/Listado.tsx                  # + indicador de estado de validación por fila
    └── pages/ConciliacionDian.tsx         # pantalla nueva: subir el Excel, ver el resultado de la conciliación
```

**Structure Decision**: Web application ya existente (monorepo pnpm + Turborepo: `apps/api` NestJS/Prisma, `apps/web` Vite/React, `packages/domain` TypeScript puro) — misma estructura que 001/002, sin proyectos nuevos. Se agrega un módulo de NestJS nuevo (`validacion-dian`) en vez de ampliar `modules/invoices`, siguiendo el mismo criterio de separación ya usado para `modules/extraction`: es una responsabilidad de negocio claramente distinta (validación externa contra la DIAN) aunque opere sobre la misma entidad `Factura`.

## Complexity Tracking

Sin violaciones de la Constitution Check — esta sección no aplica.
