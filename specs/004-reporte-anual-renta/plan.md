# Implementation Plan: Reporte anual de compras elegibles para renta

**Branch**: `004-reporte-anual-renta` | **Date**: 2026-07-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-reporte-anual-renta/spec.md`

## Summary

Un reporte anual consultable en la app (US1): para el año gravable elegido (año en curso por defecto), muestra el total en COP, el conteo, y el desglose mes a mes de las facturas ya marcadas como elegibles por la feature 001, con acceso al listado filtrado y al estado de validación DIAN (feature 003) de cada una como contexto. Y su exportación (US2) a Excel o PDF — resumen agregado + una fila por factura — para servir como soporte real ante un contador. Es una vista calculada, sin entidad de datos nueva: reutiliza `FacturaRepository.listar()` (ya filtra por rango de fecha, elegibilidad, excluye eliminadas, y ya trae `ultimaValidacionDian` embebida) y le agrega una única pieza de lógica de dominio nueva — el desglose mensual.

## Technical Context

**Language/Version**: TypeScript en modo estricto (Node.js 22 LTS backend, React 19 frontend) — mismo stack de 001/002/003, sin cambios.

**Primary Dependencies**: NestJS + Prisma (backend, ya existentes); `exceljs` (ya instalado desde 003 — ahora también para *escribir* un `.xlsx`, no solo leerlo, ver research.md § 2); `pdfmake` (nueva — generación de PDF, ver research.md § 1); React + Vite (frontend, ya existente).

**Storage**: PostgreSQL — sin cambios de esquema. El reporte consulta `facturas` (+ `validaciones_dian` como contexto) ya existentes; a lo sumo una consulta agregada nueva (rango de años con datos, research.md § 4), sin tabla ni columna nueva.

**Testing**: Jest en `packages/domain` para la única regla de dominio nueva (desglose mensual) — constitution Principio VIII.

**Target Platform**: Web — misma SPA + API ya desplegadas.

**Project Type**: Web application (monorepo ya existente: `apps/api`, `apps/web`, `packages/domain`).

**Performance Goals**: N/A específico — mismo criterio que 001/002/003 (operación de un solo usuario, bajo volumen; ver research.md § 3 sobre por qué el desglose se agrupa en memoria en vez de en SQL).

**Constraints**: El reporte MUST reutilizar exactamente la clasificación de elegibilidad ya calculada por la feature 001, sin reevaluarla (spec.md FR-002) — ninguna ruta de esta feature escribe `elegibilidadTributaria`. Toda presentación (pantalla o exportado) MUST incluir la nota del Principio IV (spec.md FR-007).

**Scale/Scope**: 2 User Stories (P1 reporte en pantalla, P2 exportación en 2 formatos), sin entidades de dominio nuevas, una función de dominio nueva.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Inmutabilidad de la Evidencia | N/A — esta feature no toca imágenes originales ni sus derivados. |
| II. Exactitud Monetaria | PASS — el total y el desglose mensual se calculan sumando `totalCentavos` (entero, ya almacenado) tal cual, sin floats ni conversión de moneda; `sumaTotal` sigue siendo COP-only (FR-009), mismo criterio que `FacturaRepository.listar()` (FR-027 de la feature 001). |
| III. Desconfianza por Defecto en la Extracción por IA | N/A directo — esta feature no extrae nada nuevo, solo organiza datos ya extraídos y clasificados. |
| IV. Clasificación Tributaria Explícita y Versionada | PASS explícito — es el principio central de esta feature: el reporte nunca recalcula ni edita `elegibilidadTributaria` (FR-002), y toda presentación (pantalla y ambos formatos exportados) incluye siempre la nota obligatoria (FR-007, US2 AC2). |
| V. Arquitectura Hexagonal | PASS — la única lógica nueva (desglose mensual: agrupar facturas por mes y sumar) es una función pura en `packages/domain`, sin importar Prisma/NestJS; los adaptadores de generación de archivo (`pdfmake`/`exceljs`) viven en `apps/api`. |
| VI. Validación DIAN sin Trampas | N/A directo — esta feature no interactúa con la DIAN; solo muestra, como contexto (FR-006), el resultado que la feature 003 ya registró. |
| VII. Privacidad y Soberanía Operativa | PASS — la exportación se genera enteramente en el backend del propio usuario; `pdfmake` fue elegido en research.md § 1 específicamente por no requerir un navegador headless externo, preservando el objetivo de costo operativo bajo. |
| VIII. Calidad Verificable | PASS — la función de desglose mensual es una regla de dominio pura con test unitario obligatorio. |

Sin violaciones — no se requiere Complexity Tracking.

**Re-check post Phase 1** (tras `data-model.md`, `contracts/api.md` y `quickstart.md`): sin cambios respecto a la evaluación inicial. El diseño detallado confirma explícitamente que el reporte nunca escribe sobre `Factura` (data-model.md § Validaciones de dominio, es de solo lectura) y que la única extensión a un endpoint existente (`moneda` en `FiltrosFactura`) es un filtro opcional retrocompatible, no una nueva escritura. La decisión de `moneda` COP-only para conteo/total (data-model.md, motivada por SC-004) refuerza el Principio II en vez de tensionarlo. Gate: PASS.

## Project Structure

### Documentation (this feature)

```text
specs/004-reporte-anual-renta/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
packages/domain/
├── src/
│   └── rules/reporte-anual.ts             # función pura: dado un año + facturas elegibles, calcular desglose de 12 meses
└── test/
    └── reporte-anual.spec.ts

apps/api/
└── src/modules/reportes/                  # módulo nuevo, depende de modules/invoices (mismo patrón que modules/validacion-dian)
    ├── reportes.module.ts
    ├── reportes.controller.ts             # GET /reportes/anual?anio=  · GET /reportes/anual/anios-disponibles · GET /reportes/anual/exportar?anio=&formato=xlsx|pdf
    ├── reporte-anual.service.ts           # orquesta: FacturaRepository.listar() (ya existente) + regla de dominio del desglose
    ├── reporte-excel.service.ts           # arma el .xlsx (exceljs) — resumen + una fila por factura
    └── reporte-pdf.service.ts             # arma el .pdf (pdfmake) — resumen + tabla por factura

apps/api/src/modules/invoices/
└── factura.repository.ts                 # + obtenerRangoAnios(): consulta agregada min/max de fechaHoraCompra (research.md § 4) — sin cambios a listar(), ya sirve tal cual para el reporte

apps/web/
└── src/
    ├── services/reportes.ts               # cliente HTTP nuevo (consultar reporte, listar años disponibles, disparar descarga de exportación)
    ├── pages/ReporteAnual.tsx             # pantalla nueva: selector de año, resumen, desglose de 12 meses, enlace al Listado filtrado, botón exportar (Excel/PDF)
    └── pages/Listado.tsx                  # sin cambios de lógica — el reporte enlaza a sus filtros existentes (fechaDesde/fechaHasta/elegibilidad) por querystring
```

**Structure Decision**: Web application ya existente (monorepo pnpm + Turborepo: `apps/api` NestJS/Prisma, `apps/web` Vite/React, `packages/domain` TypeScript puro) — misma estructura que 001/002/003, sin proyectos nuevos. Se agrega un módulo de NestJS nuevo (`reportes`) en vez de ampliar `modules/invoices`, mismo criterio de separación ya usado para `modules/extraction` y `modules/validacion-dian`: es una responsabilidad de negocio claramente distinta (agregación + exportación) aunque consuma la misma `FacturaRepository`.

## Complexity Tracking

Sin violaciones de la Constitution Check — esta sección no aplica.
