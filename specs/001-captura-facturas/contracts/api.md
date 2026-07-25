# API Contract: Captura y Registro Estructurado de Facturas

Superficie HTTP expuesta por `apps/api` (NestJS) al frontend `apps/web`. Todos los endpoints, salvo `/auth/login`, requieren la sesión autenticada de FR-030. Los cuerpos y respuestas se describen a nivel de forma, no de implementación (sin DTOs de clase todavía — eso corresponde a `/speckit-tasks`/`/speckit-implement`).

## Autenticación (FR-030)

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/auth/login` | `{ usuario, contraseña }` → cookie de sesión firmada (`httpOnly`, `secure`) |
| `POST` | `/auth/logout` | Invalida la sesión activa |

## Captura (H1 — FR-001 a FR-005)

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/invoices` | Multipart, uno o varios archivos de imagen (FR-001/FR-002). Responde `201` con un `Factura[]` en `estado: recibida` por cada imagen guardada — el guardado es síncrono e independiente por archivo (FR-003); un fallo de extracción posterior no afecta esta respuesta. |
| `GET` | `/invoices/:id/image` | Sirve el byte-stream del archivo original (o de un derivado vía `?variant=`). Nunca modifica el archivo servido. |

## Extracción y corrección (H2 — FR-006 a FR-013)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/invoices/:id` | Detalle completo: campos extraídos/corregidos, `confianzaCampos`, ítems, estado, correcciones previas, y referencia a la imagen original (FR-024). |
| `PATCH` | `/invoices/:id/fields` | `{ campo, valorCorregido }[]` — corrige uno o más campos extraídos. Crea un registro `CorrecciónManual` por campo (FR-011/FR-012); si el campo alimenta elegibilidad, recalcula `elegibilidadTributaria`/`elegibilidadMotivo` en la misma operación (FR-017). |
| `POST` | `/invoices/:id/reprocess` | Reintenta la extracción para una factura en `fallida` (FR-013). No aplica a otros estados. |

## Clasificación tributaria (H3 — FR-014 a FR-018)

No hay endpoints propios: la clasificación y la elegibilidad se calculan como parte del pipeline de extracción y quedan expuestas en `GET /invoices/:id` y en los filtros de `GET /invoices` (abajo). No existe ninguna ruta para fijar `elegibilidadTributaria` directamente — solo se deriva (FR-016).

## Consulta (H4 — FR-022 a FR-024)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/invoices` | Lista filtrable. Query params: `fechaDesde`, `fechaHasta`, `comercio`, `montoMin`, `montoMax`, `tipoDocumento`, `elegibilidad`, `estado` — combinables (FR-022). Responde `{ items: Factura[], conteo, sumaTotal }` — el agregado refleja el filtro aplicado (FR-023) y solo incluye documentos en COP (FR-027). |

## Duplicados (H5 — FR-019 a FR-021)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/invoices/duplicates/pending` | Lista las `MarcaDePosibleDuplicado` en `pendiente_confirmacion`, cada una con las dos facturas candidatas. |
| `POST` | `/invoices/duplicates/:id/resolve` | `{ resolucion: "duplicado" | "distinto" }` — resuelve una marca pendiente (FR-020). No bloquea el resto de un lote en carga (FR-021). |

## Notas de contrato

- Ningún endpoint permite un `DELETE` físico de una factura o de su imagen — eliminar es siempre soft-delete (FR-029), expuesto como una transición de estado, no como una operación HTTP `DELETE` sobre el recurso.
- `POST /invoices` es la única ruta de ingesta; no existe una ruta separada para "cámara" vs "archivo subido" — el spec los trata como equivalentes (FR-001).
