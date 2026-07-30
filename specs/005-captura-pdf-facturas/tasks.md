# Tasks: Captura de facturas electrónicas en PDF

**Input**: Design documents from `/specs/005-captura-pdf-facturas/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md — todos completos.

**Tests**: Sin tests nuevos — esta feature no introduce ninguna regla de dominio (tributaria, de cuadre monetario, de clasificación); es una extensión de infraestructura de captura que reusa el pipeline ya existente sin cambiarlo (plan.md § Testing). Mismo criterio pragmático ya aplicado en `specs/001-captura-facturas` a `specs/004-reporte-anual-renta`: solo las reglas de dominio generan test obligatorio (constitution Principio VIII), y esta feature no agrega ninguna.

**Organization**: Tareas agrupadas por historia de usuario (P1→P2), mismo orden de entrega incremental que las features anteriores — cada historia se construye, valida end-to-end, y se da por completa antes de avanzar a la siguiente. **No se paralelizan entre sí**: `/speckit-implement` se invoca acotado a una fase (Setup + Foundational + una historia) a la vez.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin colisión con otras tareas de la misma fase)
- **[Story]**: Historia de usuario a la que pertenece la tarea (US1, US2)
- Cada tarea incluye la ruta de archivo exacta

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: dependencia nueva identificada en research.md § 1 — nada de esto depende de ninguna historia.

- [X] T001 Instalar `pdf-to-png-converter` en `apps/api/package.json` (research.md § 1 — renderizado de PDF a imagen; trae consigo `@napi-rs/canvas`, binarios prebuilt, sin compilación nativa). Verificado: se resolvió `@napi-rs+canvas-darwin-x64@1.0.3`, confirmando en la práctica el soporte darwin-x64 investigado en research.md.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: la utilidad de renderizado de PDF que tanto la vista previa (US1) como la extracción (US2) consumen — ninguna historia puede mostrar ni procesar un PDF sin esto.

**⚠️ CRITICAL**: ninguna historia puede empezar hasta que esta fase esté completa.

- [X] T002 `pdf-decoder.ts` en `apps/api/src/modules/extraction/pdf-decoder.ts`: `esPdf(buffer: Buffer): boolean` (bytes mágicos `%PDF-`, research.md § 3 — nunca por extensión ni Content-Type) + `renderizarPrimeraPagina(buffer: Buffer): Promise<Buffer>` (PNG en memoria, vía `pdf-to-png-converter` con `pagesToProcess: [1]`, research.md § 1) (depende de T001)

**Checkpoint**: utilidad de renderizado lista — ambas historias pueden construirse sobre esto.

---

## Phase 3: User Story 1 - Subir un PDF y que quede capturado de inmediato (Priority: P1) 🎯 MVP

**Goal**: subir el PDF de una factura electrónica desde el mismo flujo de captura ya existente para fotos, que quede guardado de inmediato como archivo original, y que se pueda ver una vista previa navegable — sin depender de que la extracción funcione.

**Independent Test**: subir uno o varios PDFs desde la pantalla de captura existente y verificar que cada uno queda guardado, visible en el Listado con su propio estado, con vista previa navegable, y que el archivo original se puede recuperar íntegro — sin que la extracción tenga que haber terminado ni tenido éxito (spec.md User Story 1, Acceptance Scenarios 1-4).

### Implementación para User Story 1

- [X] T003 [P] [US1] `apps/web/src/pages/Captura.tsx`: el input de "Subir de galería" admite también `application/pdf` además de `image/*` (el de "Tomar foto" queda sin cambios — una cámara no puede capturar un PDF) (FR-001)
- [X] T004 [P] [US1] `ImagenWebService.obtenerParaNavegador` en `apps/api/src/modules/invoices/imagen-web.service.ts`: si el archivo original es un PDF (`esPdf`, T002), renderizar su primera página (T002) **antes** de la llamada ya existente a `decodificarImagen()` — el resto del método (resize, JPEG, `ArchivoDerivado`) sigue exactamente igual. Esto también resuelve automáticamente las miniaturas de `Captura.tsx` (`FilaCaptura`), que ya reusan este mismo endpoint — verificado, sin cambios adicionales de frontend para eso (FR-005) (depende de T002)

**Checkpoint**: US1 completa y validada — un PDF se captura, aparece en el Listado, tiene vista previa, y el original se puede recuperar íntegro, todo sin que la extracción haya corrido.

---

## Phase 4: User Story 2 - Extraer y clasificar los datos del PDF (Priority: P2)

**Goal**: que el PDF ya capturado se procese con el mismo pipeline de extracción y clasificación ya existente — mismos campos, mismo camino preferido de CUFE por QR, misma regla de elegibilidad, mismo `extraction_failed` si falla.

**Independent Test**: con un PDF de factura electrónica ya capturado (User Story 1), disparar o esperar el procesamiento y verificar que el registro termina con los mismos campos que produciría una foto nítida equivalente, incluida la clasificación de elegibilidad (spec.md User Story 2, Acceptance Scenarios 1-4).

### Implementación para User Story 2

- [X] T005 [P] [US2] `extraction.processor.ts` en `apps/api/src/modules/extraction/extraction.processor.ts`: donde hoy se lee `factura.rutaImagenOriginal` antes de `decodificarCufeDesdeQr()` y `this.extractor.extract()`, si el archivo es un PDF (`esPdf`, T002), renderizar su primera página (T002) primero — ambas llamadas siguientes reciben el PNG renderizado en vez del PDF crudo, sin ningún otro cambio en el método. Cero cambios a los cuatro adaptadores de `InvoiceExtractor` ni a `cufe-decoder.ts` (research.md § 2, FR-006/FR-007/FR-008/FR-009) (depende de T002). Motivada directamente por el error real que el usuario encontró probando US1 (`Sharp.metadata: Input buffer contains unsupported image format`, factura marcada `FALLIDA`) — confirmó exactamente el punto de integración ya documentado en research.md § 2 antes de escribir el fix.

**Checkpoint**: US1 y US2 funcionan juntas — un PDF se captura, se ve, se extrae, y se clasifica exactamente igual que una foto, sin ninguna regla nueva ni distinta.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: mejoras que afectan a ambas historias, después de que están construidas.

- [X] T006 [P] Actualizar `README.md` con la dependencia nueva (`pdf-to-png-converter`) y una nota sobre la captura de facturas en PDF (mismo flujo que una foto, mismo pipeline de extracción) — mismo estilo que las secciones ya agregadas para 002/003/004. Incluye también una nota sobre "Reprocesar" (fix no anticipado, ver abajo).
- [X] T007 Verificación estática completa de punta a punta: `tsc` + `eslint` en `packages/domain`, `apps/api`, `apps/web`; confirmar que los 70 tests de dominio ya existentes siguen en verde. La validación funcional real de `quickstart.md` (P1→P2) sí se hizo end-to-end contra la app corriendo (el usuario probó con un PDF real de "Éxito La Central"), y de ahí salieron dos hallazgos reales no anticipados en el plan original: (1) `Sharp.metadata: Input buffer contains unsupported image format` al procesar un PDF sin T005 todavía implementada — confirmó exactamente el punto de integración de research.md § 2; (2) `MIS_IDENTIFICACIONES` en `apps/api/.env` nunca se había reemplazado del valor de ejemplo (bug de configuración pre-existente, no de esta feature, pero descubierto al validar); y de paso, la máquina de estados (`packages/domain/src/state-machine/factura-estado.ts`) se amplió para permitir reprocesar una factura ya `extraída`/`necesita_revisión`, no solo `fallida` — sin esto, una factura ya procesada no podía tomar una corrección de configuración posterior sin borrar y resubir el archivo.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — arranca de inmediato
- **Foundational (Phase 2)**: depende de Setup — bloquea US1 y US2
- **User Stories (Phase 3-4)**: en orden de prioridad P1→P2, cada una depende de que la anterior esté completa y validada — no se paralelizan entre sí en este proyecto
- **Polish (Phase 5)**: depende de que ambas historias estén completas

### Dependencias entre historias

- **US1**: depende de Foundational (Phase 2). No depende de US2.
- **US2**: depende de Foundational (Phase 2). Reusa el mismo `pdf-decoder.ts` que US1 (T002) pero su integración (`extraction.processor.ts`) es un archivo distinto de la de US1 (`imagen-web.service.ts`) — independiente de que US1 esté siquiera terminada de usar en producción, solo comparte infraestructura, no resultado.

### Parallel Opportunities

- Todas las tareas `[P]` dentro de una misma fase pueden ejecutarse en paralelo (archivos distintos, sin colisión entre sí)
- Entre fases de historias de usuario: **no ejecutar en paralelo** — mismo motivo que las features anteriores (proyecto de un solo desarrollador asistido por el agente, acuerdo explícito de fase por fase con validación end-to-end)

---

## Parallel Example: User Story 1

```bash
# Una vez T002 (Foundational) está listo, son archivos distintos:
Task: "Input de 'Subir de galería' admite PDF en apps/web/src/pages/Captura.tsx"
Task: "Renderizar PDF antes de decodificarImagen() en apps/api/src/modules/invoices/imagen-web.service.ts"
```

---

## Implementation Strategy

### MVP visual (User Story 1 solamente)

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational (utilidad de renderizado — bloquea US1/US2)
3. Completar Phase 3: User Story 1
4. **DETENERSE y VALIDAR**: probar US1 de forma independiente contra `quickstart.md` § P1 (con un PDF real)
5. Confirmación humana antes de continuar con US2

### Entrega incremental

1. Setup + Foundational → utilidad de renderizado lista
2. US1 → validar independientemente → confirmación humana (MVP)
3. US2 → validar independientemente → confirmación humana
4. Polish (Phase 5)

Cada historia agrega valor sin romper la anterior — `/speckit-implement` se invoca acotado a una fase (Setup + Foundational + una historia) a la vez, igual que en `specs/001-captura-facturas` a `specs/004-reporte-anual-renta`.

---

## Notes

- `[P]` = archivos distintos, sin colisión con otras tareas de la misma fase (algunas tareas `[P]` dependen igual de una tarea anterior — la dependencia se anota entre paréntesis)
- La etiqueta `[Story]` mapea cada tarea a su historia de usuario para trazabilidad
- T004 y T005 son deliberadamente el único cambio en cada uno de sus archivos — ningún adaptador de extracción, el decodificador de CUFE, ni ninguna regla de dominio se tocan (research.md § 2) — si al implementar aparece la tentación de tocar alguno de esos archivos, es señal de que algo se está desviando del diseño
- Commitear después de cada historia completa, nunca varias historias juntas en un solo commit
- Detenerse en cada checkpoint para validación humana antes de continuar
