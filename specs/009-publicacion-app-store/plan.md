# Implementation Plan: Publicación en el Apple App Store (Fase 1)

**Branch**: `001-captura-facturas` (rama troncal real del proyecto — ver nota de `spec.md`) | **Date**: 2026-10-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-publicacion-app-store/spec.md`

## Summary

Empaquetar `apps/web` (ya construido y probado) con Capacitor para publicarlo como app nativa en el Apple App Store, sin reescribir la interfaz. Para no ser rechazado por la Guideline 4.2 ("Minimum Functionality"), la app gana una capacidad nativa real — cámara nativa en el flujo de captura de facturas, no notificaciones push (research.md § Decisión 2: push exige secretos y tablas nuevas sin beneficio adicional). El borrado de cuenta ya construido (specs/008) solo se confirma, no se reconstruye. El resto de la fase (ficha en App Store Connect, política de privacidad, TestFlight) es trabajo de publicación, no de código.

## Technical Context

**Language/Version**: TypeScript estricto, igual que el resto del monorepo. No se escribe Swift custom — `@capacitor/camera` cubre la cámara nativa sin un plugin propio.

**Primary Dependencies**: `@capacitor/core`, `@capacitor/ios`, `@capacitor/cli`, `@capacitor/camera` — todos nuevos, todos solo en `apps/web`. Ninguna dependencia nueva en `apps/api` ni en `packages/domain`.

**Storage**: N/A — no se agrega ninguna tabla ni columna nueva (research.md § Decisión 2 descarta push, que era la única razón para necesitar almacenamiento nuevo).

**Testing**: `apps/web` no tiene ningún runner de tests instalado (ni Vitest ni Jest) — el cambio de UI (selector de cámara nativa vs. `<input type="file">`) se verifica a mano; igual todo lo que un test automatizado no podría cubrir de todas formas (empaquetado, revisión de Apple), vía simulador/dispositivo real con Xcode y TestFlight.

**Target Platform**: iOS 15+ (research.md § Decisión 4).

**Project Type**: Empaquetado nativo de una web app ya existente (no es un servicio nuevo ni una reescritura).

**Performance Goals**: Ninguno nuevo — se hereda el rendimiento ya validado de `apps/web`; Capacitor renderiza sobre un WebView del sistema, no agrega una capa de renderizado propia.

**Constraints**: Costo de infraestructura adicional recurrente = 0 (el único costo nuevo es la cuota anual de Apple Developer Program, ya contemplada en `constitution.md` v2.2.0, SC-004).

**Scale/Scope**: Una plataforma nueva (iOS), 5 historias de usuario, 0 entidades de dominio nuevas, 0 endpoints nuevos.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
| --- | --- |
| I. Inmutabilidad de la Evidencia | ✅ Compliant — la cámara nativa entrega el archivo al mismo pipeline de carga ya existente; ningún cambio a cómo se guardan o transforman los originales. |
| II. Exactitud Monetaria | ✅ N/A — no toca dinero. |
| III. Desconfianza por Defecto en la Extracción por IA | ✅ N/A — no toca extracción. |
| IV. Clasificación Tributaria | ✅ N/A — no toca clasificación. |
| V. Arquitectura Hexagonal | ✅ Compliant — el proyecto Capacitor vive dentro de `apps/web` (research.md § Decisión 3); `packages/domain` no se toca. |
| VI. Validación DIAN | ✅ N/A — no toca DIAN. |
| VII. Privacidad y Soberanía Operativa | ✅ Compliant, reforzado por la propia Decisión 2: elegir cámara nativa sobre push evita introducir cualquier servicio de terceros nuevo — "Telemetría a terceros: cero" se mantiene sin ninguna ambigüedad, y no se agrega ningún secreto ni costo recurrente nuevo. |
| VIII. Calidad Verificable | ✅ Compliant — el cambio de UI (cámara nativa vs. input web) no introduce ninguna regla de dominio nueva, así que no dispara el requisito de test unitario de dominio; sí se agrega una prueba de regresión del flujo de carga existente (ver tasks). |

**Resultado**: sin violaciones. No hace falta "Complexity Tracking".

**Re-evaluación tras Phase 1**: Decisiones 2 y 3 de research.md ya estaban reflejadas en esta tabla desde la primera pasada; ningún hallazgo de Phase 1 cambió el resultado.

## Project Structure

### Documentation (this feature)

```text
specs/009-publicacion-app-store/
├── plan.md              # Este archivo
├── research.md          # Phase 0 — decisiones 1-4
├── data-model.md         # Phase 1 — sin entidades nuevas
├── quickstart.md        # Phase 1 — guía de validación de punta a punta
└── tasks.md             # Phase 2 (/speckit-tasks) — todavía no existe
```

No se generó `contracts/`: esta fase no agrega ni cambia ningún endpoint de `apps/api` (research.md § Decisión 2 descarta push, que era el único motivo para necesitar un contrato nuevo).

### Source Code (repository root)

```text
apps/web/
├── capacitor.config.ts   # NUEVO — configuración de Capacitor
├── ios/                   # NUEVO — proyecto Xcode generado por `npx cap add ios`
└── src/
    └── ...                # cambio puntual: el flujo de captura usa @capacitor/camera
                            # en nativo, y sigue usando <input type="file"> en web
                            # (misma rama de código ya existente, solo con un origen
                            # de archivo nuevo condicionado a la plataforma)
```

**Structure Decision**: Todo vive dentro de `apps/web`, el paquete pnpm que ya existe — no se crea ningún paquete nuevo en el monorepo (research.md § Decisión 3). `apps/api` y `packages/domain` quedan sin cambios en esta fase.

## Complexity Tracking

Vacío — sin violaciones que justificar.
