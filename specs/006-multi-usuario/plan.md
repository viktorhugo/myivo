# Implementation Plan: Registro abierto con aislamiento total entre usuarios

**Branch**: `006-multi-usuario` | **Date**: 2026-07-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-multi-usuario/spec.md`

## Summary

Reemplazar la autenticación de un solo usuario (`AUTH_USERNAME`/`AUTH_PASSWORD_HASH`) por cuentas reales de registro abierto con verificación de correo (`better-auth`), y aislar totalmente los datos entre cuentas con dos capas: `usuarioId` en `Factura` a nivel de aplicación, y Row-Level Security de PostgreSQL como garantía a nivel de base de datos (research.md § 3) — exactamente lo que exige la enmienda del Principio VII (constitution v2.0.0). `MIS_IDENTIFICACIONES` pasa de variable de entorno global a configuración propia de cada cuenta, sin tocar la regla de elegibilidad del dominio (ya la recibe como parámetro). Los datos ya capturados por Victor migran a su propia cuenta nueva, ya verificada, en el mismo despliegue.

## Technical Context

**Language/Version**: TypeScript en modo estricto (Node.js 22 LTS backend, React 19 frontend) — mismo stack de 001-005, sin cambios.

**Primary Dependencies**: `better-auth` + su adaptador de Prisma (nuevo — reemplaza el módulo `auth` actual y `express-session`, research.md § 1); `resend` (nuevo — envío del correo de verificación, research.md § 2); `@nestjs-cls/transactional` (nuevo — propagación de una única transacción por request, necesaria para que Row-Level Security funcione de forma segura con connection pooling, research.md § 3); NestJS + Prisma (ya existentes, sin cambios de versión).

**Storage**: PostgreSQL — cambio de esquema real: tabla `Usuario` nueva (correo, contraseña, estado de verificación, identificaciones tributarias propias — gestionada en parte por el adaptador de Prisma de Better Auth); `Factura` gana `usuarioId` (FK, obligatoria); políticas de Row-Level Security nuevas en `Factura` y en las tablas que ya cuelgan de ella (`ItemFactura`, `CorreccionManual`, `ExtraccionCruda`, `MarcaPosibleDuplicado`, `ValidacionDian`) vía join implícito a través de `facturaId`.

**Testing**: Jest en `packages/domain` — esta feature no introduce reglas de dominio nuevas (`evaluarElegibilidad2026` ya recibe `identificacionesPropias` como parámetro, sin cambios — confirma que la Arquitectura Hexagonal ya pagaba este desacople). **Excepción deliberada** al criterio de "sin tests en `apps/api`" ya sostenido en 001-005: dado que el aislamiento es "no negociable" (constitution Principio VII v2.0.0), esta feature incluye al menos un test de integración en `apps/api` que verifique aislamiento cruzado real entre dos cuentas — no basta con revisión manual para la garantía central de privacidad de esta feature.

**Target Platform**: Web — misma SPA + API ya desplegadas.

**Project Type**: Web application (monorepo ya existente).

**Performance Goals**: N/A específico — mismo criterio de 001-005; envolver cada request en una transacción (para RLS) es una sobrecarga aceptable a esta escala.

**Constraints**: Cero dependencia de un proveedor de auth de terceros hospedado (research.md § 1 — Better Auth corre en el propio backend); la única llamada de red nueva a un tercero (Resend, para el correo de verificación) MUST limitarse exclusivamente a ese correo — nunca telemetría de uso/consumo (constitution Principio VII).

**Scale/Scope**: 2 User Stories (P1 registro+verificación+aislamiento total, P2 gestión de la propia cuenta), 1 entidad nueva (`Usuario`), 1 columna nueva en `Factura`, políticas RLS en 6 tablas, reemplazo completo del módulo `auth` actual — toca transversalmente los módulos `invoices`, `extraction`, `validacion-dian`, y `reportes`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Inmutabilidad de la Evidencia | N/A — esta feature no toca el manejo de archivos originales/derivados, solo quién es dueño de cada registro. |
| II. Exactitud Monetaria | N/A — no cambia ningún cálculo monetario. |
| III. Desconfianza por Defecto en la Extracción por IA | N/A — no toca el pipeline de extracción. |
| IV. Clasificación Tributaria Explícita y Versionada | PASS — `evaluarElegibilidad2026` ya recibe `identificacionesPropias` como parámetro, no lo lee de un env var directamente; esta feature solo cambia de dónde viene ese valor (configuración por cuenta en vez de variable global) sin tocar la función de dominio. |
| V. Arquitectura Hexagonal | PASS — el dominio sigue sin conocer Better Auth, Prisma, ni RLS; el aislamiento se resuelve enteramente en la capa de infraestructura. |
| VI. Validación DIAN sin Trampas | N/A — sin cambios a esa feature más allá de acotarla por cuenta (FR-006 del spec). |
| VII. Privacidad y Soberanía Operativa | PASS explícito — es el principio que esta feature existe para implementar (enmienda v2.0.0). Autoalojado en su totalidad (Better Auth corre en el propio backend; RLS es nativo de Postgres); la única llamada de red nueva a un tercero (Resend) se limita al correo de verificación que el propio usuario recibe — no es telemetría, y su costo es cero al volumen esperado (research.md § 2). Aislamiento total verificado con RLS, no solo con disciplina de código (research.md § 3). |
| VIII. Calidad Verificable | PASS, con una excepción deliberada — ver Testing arriba: sin reglas de dominio nuevas, pero sí un test de integración en `apps/api` verificando aislamiento cruzado real, justificado porque aquí "pragmático" no puede significar "solo revisión manual" para la garantía central del principio. |

Sin violaciones — no se requiere Complexity Tracking.

**Re-check post Phase 1** (tras `data-model.md`, `contracts/api.md` y `quickstart.md`): sin cambios respecto a la evaluación inicial. El diseño detallado confirma que ninguna regla de dominio existente se modifica (solo se le sigue pasando el mismo tipo de parámetro, ahora desde otro origen), y que RLS + `usuarioId` a nivel de aplicación son dos capas independientes — ninguna reemplaza a la otra. Gate: PASS.

## Project Structure

### Documentation (this feature)

```text
specs/006-multi-usuario/
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
├── prisma/schema.prisma                       # + model Usuario (Better Auth); + Factura.usuarioId (FK obligatoria);
│                                                 + políticas RLS (migración SQL cruda, Prisma no las expresa nativamente)
├── src/config/env.schema.ts                    # - AUTH_USERNAME/AUTH_PASSWORD_HASH/MIS_IDENTIFICACIONES (se eliminan);
│                                                 + variables nuevas de Better Auth y Resend
├── src/modules/auth/                            # reemplazo completo del módulo actual:
│   ├── auth.module.ts                           #   better-auth reemplaza auth.service.ts/auth.controller.ts/
│   │                                             #   login.dto.ts existentes
│   ├── session-usuario.guard.ts                 #   sustituye session-auth.guard.ts — además de autenticar,
│   │                                             #   expone el usuarioId de la sesión a la request
│   └── rls-transaction.interceptor.ts           #   nuevo: envuelve cada request en una transacción de Prisma +
│                                                 #   SET LOCAL del usuarioId (research.md § 3), vía
│                                                 #   @nestjs-cls/transactional
├── src/modules/invoices/factura.repository.ts   # todo método de consulta gana `usuarioId` explícito en el `where`
│                                                 # (defensa en profundidad — RLS es la garantía real, esto es la
│                                                 # intención explícita a nivel de aplicación)
├── src/modules/invoices/duplicate-matching.service.ts  # detección de duplicados acotada a la misma cuenta (FR-006)
├── src/modules/validacion-dian/validacion-dian.repository.ts  # + usuarioId
├── src/modules/reportes/reporte-anual.service.ts       # + usuarioId
└── test/aislamiento-cuentas.e2e-spec.ts         # nuevo: test de integración de aislamiento cruzado (Testing, arriba)

apps/web/
└── src/
    ├── pages/Login.tsx                          # + registro (correo/contraseña), + pantalla de "verifica tu correo"
    ├── pages/CuentaPropia.tsx                   # nueva (US2): cambiar contraseña, configurar identificación tributaria
    └── App.tsx                                  # + rutas de registro/verificación

packages/domain/
└── (sin cambios — evaluarElegibilidad2026 y el resto de reglas ya reciben sus parámetros externamente)
```

**Structure Decision**: Web application ya existente (monorepo pnpm + Turborepo) — sin proyectos nuevos. A diferencia de toda feature anterior (001-005), esta SÍ es transversal: no vive en un módulo nuevo aislado, porque su propósito es acotar por cuenta a los módulos que ya existen. El módulo `auth` se reemplaza en vez de extenderse (Better Auth trae su propio modelo de sesión, incompatible con `express-session`).

## Complexity Tracking

Sin violaciones de la Constitution Check — esta sección no aplica.
