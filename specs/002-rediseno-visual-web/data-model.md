# Data Model: Rediseño visual — temas Industry/Nocturne

Extiende `specs/001-captura-facturas/data-model.md` — esta feature no introduce entidades de negocio nuevas, solo materializa dos campos que ya estaban documentados ahí pero nunca se construyeron, y agrega una preferencia de presentación sin relación con los datos de negocio. Todo lo no mencionado aquí (Ítem de Factura, Corrección Manual, Marca de Posible Duplicado, Extracción Cruda, reglas de cuadre monetario y elegibilidad) permanece exactamente igual — ver el documento de 001 para su definición completa.

## Factura (Documento de Compra) — campos que se materializan

| Campo | Tipo | Notas |
|---|---|---|
| `estado` | enum: `recibida` \| `procesando` \| `extraída` \| `necesita_revisión` \| `fallida` \| `varias_facturas` | Se agrega `varias_facturas` al enum ya existente (FR-010) |
| `eliminadaEn` | timestamp, nullable | Ya estaba documentado en `data-model.md` de la feature 001 (FR-029 original) pero nunca se materializó en el schema real — esta feature lo agrega (FR-009) |

**Validaciones de dominio nuevas**:
- `varias_facturas` es un estado terminal alcanzable únicamente desde `procesando` (igual que `extraída`/`necesita_revisión`/`fallida`) — ninguna transición sale de él; el usuario recaptura fotos nuevas por separado en vez de reintentar sobre el mismo registro (Clarifications, sesión 2026-07-27).
- Cuando la transición a `varias_facturas` ocurre, ningún campo extraído (`comercioNombre`, `totalCentavos`, `items`, etc.) se puebla con datos — el registro queda con esos campos en su valor por defecto (`null`/vacío), igual que quedan al crearse en `recibida`.
- `eliminadaEn` MUST ser ortogonal a `estado` — una factura puede eliminarse (soft-delete) sin importar en qué valor de `estado` se encuentre; eliminar NUNCA recalcula ni modifica ningún otro campo (Edge Cases del spec).
- Toda consulta de lectura (detalle por id, listado, agregados) MUST excluir por defecto los registros con `eliminadaEn` no nulo — comportamiento equivalente a "no encontrado" ante una consulta directa (Clarifications, sesión 2026-07-27).

## Máquina de Estados de `Factura.estado` (actualizada)

```text
recibida ──────────────► procesando
                             │
       ┌──────────────┬──────┼──────────────┬───────────────┐
       ▼              ▼      ▼              ▼               ▼
   extraída    necesita_revisión         fallida      varias_facturas
       ▲              │                     │
       └──────────────┘                     │
                      ▲ (reintento)         │
                      └──────────────────────┘
```

| Transición | Disparador |
|---|---|
| *(todas las de `specs/001-captura-facturas/data-model.md` sin cambios)* | |
| `procesando → varias_facturas` | El modelo de extracción señala, como parte de su salida validada, que la imagen contiene más de un documento de compra (FR-010) |

`varias_facturas` no tiene transiciones salientes — no existe "reintento" sobre el mismo registro; el usuario recaptura como fotos nuevas e independientes (que crean sus propios registros `recibida` desde cero).

## Preferencia de tema (nueva — presentación pura, sin persistencia de servidor)

No es una entidad de negocio ni vive en la base de datos — se documenta aquí solo porque aparece en `spec.md` § Key Entities.

| Campo | Tipo | Notas |
|---|---|---|
| valor | enum: `industry` \| `nocturne` \| `system` | `system` sigue la preferencia de color del sistema operativo/navegador (FR-002) |
| almacenamiento | `localStorage` del navegador | Ver `research.md` § 3 — sin vínculo con ningún dato de negocio ni con el backend |

## Relaciones

Sin cambios respecto a `specs/001-captura-facturas/data-model.md` — el soft-delete y el nuevo valor de estado son campos sobre la misma entidad `Factura`, no relaciones nuevas.
