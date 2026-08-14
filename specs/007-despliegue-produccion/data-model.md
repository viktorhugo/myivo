# Data Model: Despliegue en Producción

Esta feature es operacional, no de producto: no agrega entidades de negocio nuevas. Los dos "Key Entities" que describe `spec.md` (Respaldo, Evento de recuperación al arranque) se evalúan abajo y **ninguno se modela como tabla de Postgres nueva** — ambos se resuelven con una representación más simple y ya justificada en research.md. El único cambio real de esquema es sobre `Factura`/`ItemFactura`, ya existentes.

## Cambios de esquema

### 1. Columnas monetarias: `Int` → `BigInt`

Corrige el bug de rango descrito en US6/FR-022-024 (research.md § 8). Sin cambio de significado (siguen siendo centavos enteros, Principio II) ni de nombre — solo de tipo SQL.

| Modelo | Columna | Antes | Después |
|---|---|---|---|
| `Factura` | `subtotalCentavos` | `Int?` | `BigInt?` |
| `Factura` | `impuestoConsumoCentavos` | `Int?` | `BigInt?` |
| `Factura` | `propinaCentavos` | `Int?` | `BigInt?` |
| `Factura` | `totalCentavos` | `Int?` | `BigInt?` |
| `ItemFactura` | `valorUnitarioCentavos` | `Int?` | `BigInt?` |
| `ItemFactura` | `valorTotalCentavos` | `Int?` | `BigInt?` |

`ivaPorTarifa[].valorCentavos` (dentro de la columna `Json` `ivaPorTarifa`) **no cambia** — nunca fue una columna `int4`, no tiene el límite de 21,4 millones.

**Frontera de conversión** (única, en `apps/api/src/modules/invoices/factura.repository.ts`):
- Lectura (`aDominio()`, `obtenerItems()`, agregado `_sum.totalCentavos` de `listar()`): `Number(valor)` si no es `null`.
- Escritura (`guardarResultadoExtraccion()`, `aplicarCorreccion()`): `BigInt(valor)` sobre el `number` que ya produce `parsearEntero()`/la extracción.
- `Prisma.IntNullableFilter` → `Prisma.BigIntNullableFilter` en el filtro `montoMin`/`montoMax` de `listar()`.

`packages/domain` (interfaz `Factura`/`ItemFactura`), los DTOs de la API, `apps/web` y los generadores de reporte (Excel/PDF/reporte anual) **no cambian de tipo** — siguen viendo `number`. Justificación de por qué esto es seguro: research.md § 8.

**Migración**: `ALTER TABLE facturas ALTER COLUMN "subtotalCentavos" TYPE bigint`, ídem para las otras 5 columnas — sin pérdida de datos (Principio I/FR-024), `bigint` es superconjunto exacto de `int4`.

### 2. Índices nuevos en `facturas`

Ninguno existe hoy más allá de la llave primaria (verificado contra las 10 migraciones existentes — research.md § 9).

| Índice | Tipo | Cubre |
|---|---|---|
| `(usuarioId, eliminadaEn, fechaHoraCompra)` | B-tree compuesto | Listado/filtro por fecha (FR-025); también acelera el prefiltro de la búsqueda difusa de duplicados. |
| `(usuarioId, cufe)` | B-tree compuesto | Duplicado exacto por CUFE (FR-026, `DuplicateMatchingService.detectarYRegistrar`). |
| `comercioNombreNormalizado` | GIN (`gin_trgm_ops`, `pg_trgm`) | Prefiltro de la coincidencia difusa por similitud de nombre de comercio (complementa el índice B-tree de arriba). |

El índice GIN trgm se agrega como SQL crudo dentro de la migración generada por Prisma (`prisma migrate dev --create-only` + edición manual, mismo patrón ya usado para las políticas RLS en `20260801043357_rls_policies`) — Prisma no modela `USING gin (... gin_trgm_ops)` de forma nativa en `schema.prisma`.

## Key Entities del spec — resueltas sin tabla nueva

### Respaldo

El spec lo describe como "un snapshot cifrado, con fecha y hora... con un resultado (exitoso/fallido) consultable por el usuario y una fecha de expiración según la política de retención."

**Representación elegida**: archivos en disco, no una fila de Postgres.
- El snapshot en sí: `backups/myivo-<timestamp>.tar.age` (o similar) en el VPS + su copia en el proveedor de almacenamiento externo — ya es "un archivo con fecha", no necesita una tabla para tener esas propiedades.
- Retención: `find ... -mtime +N -delete` (patrón ya usado por `backup-db.sh`) — expira por sí solo, no requiere una consulta a BD para calcular expiración.
- Resultado consultable: `backups/ultimo-estado.json` — `{ fecha: string, resultado: 'ok' | 'fallido', mensaje?: string }`, sobrescrito por cada corrida del script, leído por el endpoint de salud (contracts/health.md).

**Por qué no una tabla**: preguntar "¿mi respaldo de la base de datos funcionó anoche?" no debería depender de poder hacer una consulta exitosa a esa misma base de datos — un archivo en disco es la representación que sigue siendo consultable incluso si la BD está degradada, que es precisamente el escenario donde más importa saber si hay un respaldo bueno al que volver.

### Evento de recuperación al arranque

El spec lo describe como "registro de que una factura fue transicionada automáticamente desde 'procesando' a un estado reintentable... incluye la factura afectada, el estado origen/destino y el momento."

**Representación elegida**: una línea de log estructurado (JSON, vía `JsonLoggerService` ya existente), no una tabla nueva. FR-016 lo pide literalmente así: "MUST quedar registrada en el log del sistema" — no dice "en la base de datos". Forma de la entrada:

```json
{
  "timestamp": "...",
  "level": "warn",
  "context": "RecuperacionArranque",
  "message": "Factura recuperada al arranque",
  "facturaId": "...",
  "usuarioId": "...",
  "estadoOrigen": "procesando",
  "estadoDestino": "fallida"
}
```

**Por qué no una tabla**: es información de diagnóstico operativo (Principio VIII: "se testea lo que puede estar mal de forma silenciosa" — esto es exactamente lo opuesto, un evento que ya se registra de forma ruidosa), sin ningún flujo de producto que necesite consultarlo estructuradamente más allá de leer el log. Agregar una tabla + migración + modelo de dominio para esto sería complejidad no pedida por ningún FR.

## Variables de entorno nuevas (superficie de configuración de esta feature)

Ver `contracts/env-vars.md` para la lista completa con defaults — no se listan aquí para no duplicar.
