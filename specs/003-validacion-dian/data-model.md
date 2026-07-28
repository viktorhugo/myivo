# Data Model: Validación y conciliación contra la DIAN

Extiende `specs/001-captura-facturas/data-model.md` — esta feature no modifica la entidad `Factura` ni ninguna de sus reglas ya existentes (clasificación, elegibilidad, duplicados). Agrega una entidad nueva, relacionada, puramente de auditoría/trazabilidad.

## ValidacionDian (nueva entidad)

Un registro de que el usuario (validación manual) o el proceso de conciliación en lote confirmó el estado de un CUFE contra la DIAN.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `facturaId` | uuid, FK → `Factura` | Una factura puede tener cero, una, o varias validaciones (append-only — FR-010) |
| `metodo` | enum: `manual` \| `conciliacion` | FR-004 |
| `resultado` | enum: `valido_vigente` \| `no_encontrado` \| `anulado_reemplazado` \| `otro` | Conjunto cerrado (Clarifications, sesión 2026-07-28) |
| `snapshotComercioNombre` | string, nullable | Copia de `Factura.comercioNombre` en el momento de la validación |
| `snapshotTotalCentavos` | int, nullable | Copia de `Factura.totalCentavos` en el momento de la validación — entero, nunca float (constitution Principio II) |
| `snapshotMoneda` | string | Copia de `Factura.moneda` en el momento de la validación |
| `snapshotFechaHoraCompra` | timestamp, nullable | Copia de `Factura.fechaHoraCompra` en el momento de la validación |
| `snapshotCufe` | string | Copia de `Factura.cufe` en el momento de la validación — el CUFE que efectivamente se validó, incluso si el usuario lo corrige después |
| `creadaEn` | timestamp | Fecha/hora de la consulta (FR-004) |

**Validaciones de dominio**:
- `ValidacionDian` MUST NOT crearse para una `Factura` cuyo `cufe` sea nulo (FR-005) — se valida antes de construir el snapshot, no después.
- Es **append-only**: no existe una operación de "editar" ni "eliminar" una `ValidacionDian` ya creada — un nuevo resultado sobre la misma factura es un registro nuevo, no una actualización del anterior (Edge Cases del spec, Acceptance Scenario 5 de US1).
- El "resultado más reciente" de una factura (para FR-006, mostrarlo en Listado/Detalle) se deriva por `creadaEn DESC LIMIT 1` — no se materializa como un campo redundante en `Factura`, para no crear una segunda fuente de verdad que se pueda desincronizar.
- `ValidacionDian` MUST NOT escribir ni modificar `Factura.elegibilidadTributaria`, `Factura.tipoDocumento`, ni ningún otro campo de `Factura` — es información complementaria de auditoría, nunca una entrada del cálculo de elegibilidad (constitution Principio IV).

## Relaciones

- `Factura 1 ── N ValidacionDian` (una factura, muchas validaciones a lo largo del tiempo — nunca al revés).
- Sin relación con `MarcaPosibleDuplicado`, `CorreccionManual`, ni `ExtraccionCruda` — son conceptos ortogonales entre sí, cada uno con su propio propósito de auditoría.

## Regla de dominio: conciliación en lote (US2)

Dado el conjunto de CUFEs extraídos de un documento de conciliación (research.md § 3) y el conjunto de facturas ya capturadas (con `cufe` no nulo y `eliminadaEn` nulo — nunca concilia facturas eliminadas), la función pura de dominio determina, para cada factura, si su `cufe` aparece en el documento aportado.

- Coincidencia MUST ser exacta (comparación de cadena, no difusa — a diferencia de la detección de duplicados por comercio/fecha/total de la feature 001/002, aquí ambos lados son CUFEs, que MUST coincidir carácter por carácter o no coinciden en absoluto).
- Un CUFE del documento que no corresponde a ninguna factura capturada se ignora — esta feature nunca crea facturas nuevas (Edge Cases del spec).
- Cada coincidencia produce una `ValidacionDian` con `metodo = 'conciliacion'`, `resultado = 'valido_vigente'` (estar en el listado oficial de documentos recibidos de la DIAN implica que el documento es válido y fue recibido) y el snapshot correspondiente.
