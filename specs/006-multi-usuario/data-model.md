# Data Model: Registro abierto con aislamiento total entre usuarios

Extiende `specs/001-captura-facturas/data-model.md` (entidad `Factura` y las que dependen de ella) — esta feature agrega una entidad nueva (`Usuario`) y una relación nueva obligatoria en `Factura`, más una capa de aplicación de esa relación a nivel de base de datos (Row-Level Security).

## Usuario (entidad nueva)

Gestionada en gran parte por el adaptador de Prisma de Better Auth (research.md § 1) — los campos exactos de sesión/credenciales los define esa librería; los siguientes son los relevantes al dominio de este proyecto:

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `correo` | string, único | Identificador de inicio de sesión (Clarifications, sesión 2026-07-30) |
| `correoVerificadoEn` | timestamp, nullable | `null` hasta completar la verificación (FR-002) — una cuenta con esto en `null` MUST NOT poder iniciar sesión ni acceder a ningún dato |
| `identificacionesTributarias` | string[] | Reemplaza la variable de entorno `MIS_IDENTIFICACIONES` (FR-007) — propia de cada cuenta, editable desde la app (US2) |
| `creadaEn` | timestamp | |

Más los campos de credenciales/sesión que gestiona Better Auth (hash de contraseña, tokens de verificación, etc. — no se listan aquí porque son responsabilidad de la librería, no del dominio de este proyecto).

**Validaciones de dominio**:
- `correo` MUST ser único — un segundo registro con el mismo correo se rechaza, nunca crea una cuenta duplicada ni sobrescribe la existente (Edge Cases del spec).
- Ninguna operación de captura, consulta, ni corrección MUST ejecutarse para una `Usuario` cuyo `correoVerificadoEn` sea `null` (FR-002).

## Factura (existente, feature 001) — gana `usuarioId`

| Campo nuevo | Tipo | Notas |
|---|---|---|
| `usuarioId` | uuid, FK → `Usuario`, obligatoria (`NOT NULL`) | El dueño de la factura — quien la capturó. Nunca nulo: ni una foto/PDF puede existir sin una cuenta que la haya subido (a diferencia de campos como `comercioNombre`, que sí empiezan en `null` hasta que la extracción los llena) |

**Validaciones de dominio**:
- Toda consulta, filtro, o agregado sobre `Factura` (Listado, Detalle, duplicados, validación DIAN, reporte anual) MUST estar acotado por el `usuarioId` de la sesión actual — sin excepción (FR-004).
- Las tablas que ya dependen de `Factura` (`ItemFactura`, `CorreccionManual`, `ExtraccionCruda`, `MarcaPosibleDuplicado`, `ValidacionDian`) no ganan su propia columna `usuarioId` — quedan acotadas transitivamente por su relación con `Factura` (`facturaId`), incluida en la misma política de Row-Level Security vía join (research.md § 3). `MarcaPosibleDuplicado` en particular representa un par de facturas candidatas a duplicado; como la detección ya está acotada a una sola cuenta (FR-006), ambas facturas del par siempre pertenecen al mismo `usuarioId`.

## Aislamiento a dos capas (research.md § 3)

1. **Aplicación**: todo método de `factura.repository.ts` y equivalentes (`duplicate-matching.service.ts`, `validacion-dian.repository.ts`, `reporte-anual.service.ts`) MUST incluir `usuarioId` explícito en su `where` de Prisma — expresa la intención en el propio código, no depende de memoria.
2. **Base de datos (Row-Level Security)**: políticas RLS en `Factura` y en las tablas que dependen de ella, comparando contra una variable de sesión de Postgres (`app.usuario_id` o equivalente) fijada por request vía `SET LOCAL`, dentro de una transacción (research.md § 3 — detalle técnico de por qué `SET LOCAL` dentro de una transacción es obligatorio con connection pooling, no una alternativa estilística). Esta capa es la que hace el aislamiento "no negociable" (constitution Principio VII v2.0.0): si la capa de aplicación tuviera un bug y olvidara el filtro, RLS igual lo bloquea.

Ninguna de las dos capas sustituye a la otra — son independientes y ambas MUST estar presentes.

## Migración de datos existentes (research.md § 4)

Un script de migración de datos (no solo de esquema), ejecutado una sola vez al desplegar esta feature:
1. Crea una `Usuario` para Victor, con `correoVerificadoEn` ya poblado (sin pasar por el flujo de registro/verificación — Acceptance Scenario 8 de US1).
2. Asigna el `id` de esa `Usuario` como `usuarioId` de todas las filas de `Factura` ya existentes.

No debe existir, en ningún momento del despliegue, una fila de `Factura` con `usuarioId` nulo ni visible sin dueño asignado (Edge Cases del spec).
