# Implementation Plan: Captura de facturas electrónicas en PDF

**Branch**: `005-captura-pdf-facturas` | **Date**: 2026-07-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-captura-pdf-facturas/spec.md`

## Summary

Permitir subir el PDF de una factura electrónica (tal cual llega por correo) desde el mismo flujo de captura ya existente para fotos, y que se procese con el mismo pipeline de extracción/clasificación ya existente (feature 001) — sin pantalla separada, sin reglas nuevas, sin pipeline de extracción alternativo. La única pieza técnica nueva es renderizar la primera página del PDF a una imagen en memoria (`pdf-to-png-converter`, research.md § 1) justo antes de los dos puntos donde el pipeline ya existente empieza a trabajar con un `Buffer` de imagen (`extraction.processor.ts` y `ImagenWebService`) — verificado contra el código real que ambos ya reciben un `Buffer` genérico, así que ningún adaptador de extracción, el decodificador de CUFE, ni las reglas de dominio necesitan cambiar.

## Technical Context

**Language/Version**: TypeScript en modo estricto (Node.js 22 LTS backend — `pdf-to-png-converter` exige Node.js ≥22.13, dentro del mismo LTS ya usado; React 19 frontend) — mismo stack de 001-004, sin cambios.

**Primary Dependencies**: NestJS + Prisma, `sharp`, `jsqr` (backend, ya existentes, sin cambios); `pdf-to-png-converter` (nueva — renderizado de PDF a imagen, research.md § 1), que trae consigo `@napi-rs/canvas` con binarios prebuilt (incluido `darwin-x64`, sin compilación nativa); React + Vite (frontend, ya existente).

**Storage**: PostgreSQL — sin cambios de esquema. `Factura.rutaImagenOriginal` ya es funcionalmente genérico (research.md § 4) y admite un PDF sin ninguna migración.

**Testing**: Jest en `packages/domain` — esta feature no introduce ninguna regla de dominio nueva (tributaria, de cuadre monetario, de clasificación); es una extensión de infraestructura de captura (nuevo tipo de archivo de entrada al pipeline ya existente), así que no genera un test de dominio obligatorio bajo el criterio ya establecido (constitution Principio VIII) — mismo criterio pragmático de 001-004: sin tests de contrato/integración nuevos en `apps/api`.

**Target Platform**: Web — misma SPA + API ya desplegadas.

**Project Type**: Web application (monorepo ya existente: `apps/api`, `apps/web`, `packages/domain`).

**Performance Goals**: N/A específico — mismo criterio de operación de un solo usuario que 001-004. El renderizado de un PDF añade latencia al pipeline de extracción (una página, no todo el documento — research.md § 1), aceptable para un flujo asíncrono que ya no bloquea la captura (constitution Principio III).

**Constraints**: El renderizado del PDF MUST ejecutarse enteramente en el propio backend del usuario, sin subir el archivo a ningún servicio externo de conversión (constitution Principio VII) — `pdf-to-png-converter` corre localmente, sin llamada de red adicional.

**Scale/Scope**: 2 User Stories (P1 captura inmediata, P2 extracción/clasificación), sin entidades de dominio nuevas, una dependencia nueva, cambios puntuales en 3 archivos existentes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Inmutabilidad de la Evidencia | PASS — el PDF se guarda como archivo original inmutable exactamente igual que una foto (`FileStorageService` ya es agnóstico de tipo de archivo, verificado); el renderizado a imagen es un `ArchivoDerivado` nuevo, vinculado al original, nunca lo reemplaza. |
| II. Exactitud Monetaria | N/A — esta feature no toca ningún cálculo monetario; reusa el pipeline de extracción/validación ya existente sin cambios. |
| III. Desconfianza por Defecto en la Extracción por IA | PASS — `validarExtraccion()` (schema Zod) sigue aplicando sin cambios sobre la salida del LLM, sin importar si la imagen vino de una foto o de un PDF renderizado; el CUFE sigue prefiriendo el QR sobre cualquier respaldo, sin cambios a esa jerarquía (FR-007); un PDF ilegible cae a `extraction_failed`, nunca bloquea la ingesta (FR-008). |
| IV. Clasificación Tributaria Explícita y Versionada | PASS — la clasificación de documento y elegibilidad son exactamente las mismas reglas ya existentes (feature 001), sin ninguna regla nueva ni distinta por tipo de archivo de origen (FR-009). |
| V. Arquitectura Hexagonal | PASS — el renderizado de PDF es un adaptador de infraestructura nuevo en `apps/api`; el dominio (`InvoiceExtractor` port, reglas de elegibilidad/clasificación) sigue recibiendo el mismo `Buffer` de imagen que siempre esperó, sin saber que el origen fue un PDF (research.md § 2). |
| VI. Validación DIAN sin Trampas | N/A — esta feature no interactúa con la DIAN. |
| VII. Privacidad y Soberanía Operativa | PASS — el renderizado ocurre enteramente en el propio backend, sin servicio externo de conversión ni telemetría nueva. |
| VIII. Calidad Verificable | PASS — sin reglas de dominio nuevas que testear (ver Testing arriba); la detección de PDF por bytes mágicos (research.md § 3) es infraestructura, no una regla tributaria/monetaria/clasificación. |

Sin violaciones — no se requiere Complexity Tracking.

**Re-check post Phase 1** (tras `data-model.md`, `contracts/api.md` y `quickstart.md`): sin cambios respecto a la evaluación inicial. El diseño detallado confirma que ningún contrato de API cambia de forma (`POST /invoices` ya acepta cualquier tipo de archivo, verificado — `FilesInterceptor('files')` sin `fileFilter`) y que el único archivo derivado nuevo (render de PDF) sigue el mecanismo `ArchivoDerivado` ya existente sin extenderlo. Gate: PASS.

## Project Structure

### Documentation (this feature)

```text
specs/005-captura-pdf-facturas/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/api/
└── src/modules/extraction/
    ├── pdf-decoder.ts                   # nuevo: esPdf(buffer) por bytes mágicos (research.md § 3) + renderizarPrimeraPagina(buffer): Promise<Buffer> (PNG) sobre pdf-to-png-converter (research.md § 1)
    └── extraction.processor.ts          # + rama: si esPdf(imagen original), renderizar antes de decodificarCufeDesdeQr()/InvoiceExtractor.extract() (research.md § 2) — sin cambios a ningún adaptador ni al decodificador de CUFE

apps/api/
└── src/modules/invoices/
    └── imagen-web.service.ts            # + misma rama que extraction.processor.ts: si el original es PDF, renderizar primero, luego el mismo resize/JPEG ya existente (FR-005)

apps/web/
└── src/pages/Captura.tsx                # accept="image/*" → admite también application/pdf en el input de "subir archivo" (no en el de cámara, que no aplica a un PDF)
```

**Structure Decision**: Web application ya existente (monorepo pnpm + Turborepo) — misma estructura que 001-004, sin proyectos nuevos, sin módulo nuevo de NestJS (a diferencia de 003/004, esta feature no agrega una responsabilidad de negocio distinta — extiende un mecanismo de infraestructura ya existente dentro de los módulos `extraction` e `invoices` actuales). `POST /invoices` (el endpoint de subida) no cambia — ya acepta cualquier tipo de archivo sin filtro, verificado contra el código real.

## Complexity Tracking

Sin violaciones de la Constitution Check — esta sección no aplica.
