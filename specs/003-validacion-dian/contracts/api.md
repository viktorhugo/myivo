# API Contract: Validación y conciliación contra la DIAN

Extiende `specs/001-captura-facturas/contracts/api.md` y `specs/002-rediseno-visual-web/contracts/api.md` — todos los endpoints ya documentados ahí permanecen sin cambios de forma. Esta feature agrega los siguientes.

## El enlace de consulta DIAN no es un endpoint

FR-001 se resuelve enteramente en el frontend: `Factura.cufe` ya viene en la respuesta de `GET /invoices/:id` (feature 001). El cliente construye el enlace como `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${cufe}` (research.md § 1) sin necesitar ningún endpoint nuevo — no hay ninguna llamada de red del backend hacia la DIAN, en ningún momento (constitution Principio VI).

## Registrar una validación manual (US1)

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/invoices/:id/validaciones-dian` | Body: `{ resultado: "valido_vigente" \| "no_encontrado" \| "anulado_reemplazado" \| "otro" }`. Crea una `ValidacionDian` con `metodo: "manual"`, tomando el snapshot de la `Factura` en ese momento (data-model.md). `404` si la factura no existe o está eliminada. `400` si `Factura.cufe` es nulo (FR-005) o si `resultado` no es uno de los cuatro valores del enum. Responde `201` con la `ValidacionDian` creada. |

## Historial de validaciones de una factura (US1)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/invoices/:id/validaciones-dian` | Devuelve el array completo de `ValidacionDian` de esa factura, ordenado por `creadaEn` descendente (más reciente primero) — FR-010. Array vacío si nunca se validó, no un error. |

## Conciliación en lote (US2)

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/invoices/dian-conciliacion` | `multipart/form-data` con un único archivo `.xlsx` (el que el usuario descargó del portal DIAN, research.md § 3). Extrae los CUFEs de la columna reconocida (tolerante a variaciones de nombre de cabecera), concilia contra las facturas con `cufe` no nulo y `eliminadaEn` nulo, y crea una `ValidacionDian` (`metodo: "conciliacion"`, `resultado: "valido_vigente"`) por cada coincidencia. `400` con mensaje claro si el archivo no es un `.xlsx` válido o no tiene ninguna columna reconocible como CUFE/CUDE (FR-009) — nunca intenta adivinar. Responde `200` con un resumen: `{ facturasConciliadas: number, cufesSinCoincidencia: number }`. |

## Comportamiento modificado en endpoints existentes

- `GET /invoices/:id` (feature 001): la respuesta de `Factura` no cambia de forma, pero el frontend ahora también consulta `GET /invoices/:id/validaciones-dian` por separado para mostrar el estado de validación en Detalle (FR-006) — se mantienen como dos llamadas independientes en vez de anidar el historial dentro de `Factura`, ya seguido el mismo patrón que `items`/`correcciones` en `FacturaDetalleDto`... **excepción**: para que el Listado (FR-006) no necesite N+1 llamadas, `GET /invoices` (listado) SÍ se extiende con un campo nuevo por ítem:
  - `ultimaValidacionDian: { resultado: ResultadoValidacionDian; creadaEn: string } | null` — la validación más reciente de esa factura, o `null` si nunca se validó. Calculado con una sola consulta agregada, no N+1.
