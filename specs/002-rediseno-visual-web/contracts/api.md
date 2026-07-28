# API Contract: Rediseño visual — temas Industry/Nocturne

Extiende `specs/001-captura-facturas/contracts/api.md` — todos los endpoints ya documentados ahí permanecen sin cambios de forma. Esta feature agrega un único endpoint nuevo y modifica el comportamiento de lectura de los existentes para excluir registros eliminados.

## Eliminar factura — soft-delete (US2 — FR-008/FR-009)

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/invoices/:id/delete` | Marca `eliminadaEn = now()` sobre el registro. **No usa el verbo HTTP `DELETE`** — decisión ya documentada en `specs/001-captura-facturas/contracts/api.md`: "eliminar es siempre soft-delete, expuesto como una transición de estado, no como una operación HTTP DELETE sobre el recurso". Responde `200` con la `Factura` actualizada (o `404` si el id no existe o ya estaba eliminada). Idempotente: eliminar una factura ya eliminada responde `404` en vez de un error, sin efectos secundarios (Edge Cases del spec). |

## Rendición de imagen apta para navegador (US1)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/invoices/:id/image?variant=web` | Devuelve una rendición **JPEG** (máx. 1600px de ancho, orientación EXIF aplicada) de la foto original. Necesaria porque las fotos de iPhone llegan en HEIC y ningún navegador las renderiza — sin esto la pantalla de detalle no puede mostrar la factura. Se genera bajo demanda la primera vez, se guarda como archivo derivado nuevo y se registra en `Factura.derivados`; las siguientes peticiones lo sirven desde disco. Sin el parámetro, el endpoint sigue devolviendo el **byte-stream original intacto** (constitution Principio I). |

## Comportamiento modificado en endpoints existentes (FR-009)

- `GET /invoices/:id`: si la factura tiene `eliminadaEn` no nulo, responde `404` (comportamiento idéntico a un id inexistente) — nunca expone datos de una factura eliminada por esta vía.
- `GET /invoices/:id/image`: mismo comportamiento — `404` si la factura subyacente está eliminada, aunque el archivo siga existiendo en el almacenamiento (FR-009: recuperable en el almacenamiento, no expuesto por ningún endpoint).
- `GET /invoices` (listado): excluye por defecto cualquier registro con `eliminadaEn` no nulo, tanto de `items` como de `conteo`/`sumaTotal` — sin necesidad de un query param explícito, ya que esta feature no incluye una pantalla de papelera (fuera de alcance, ver `spec.md` § Assumptions).

## Comportamiento modificado — resolución de duplicados (extensión de US2)

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/invoices/duplicates/:id/resolve` | Endpoint ya existente en `specs/001-captura-facturas/contracts/api.md`, sin cambio de forma (mismo body `{ resolucion: "duplicado" \| "distinto" }`, misma respuesta). **Comportamiento nuevo**: cuando `resolucion = "duplicado"`, además de marcar la `MarcaPosibleDuplicado` como `duplicado_confirmado`, el sistema hace soft-delete (`eliminadaEn = now()`) de una de las dos facturas del par — la que tenga menos campos extraídos poblados; en empate se conserva la original. `resolucion = "distinto"` no cambia: ambas facturas quedan como registros independientes. Este comportamiento no estaba especificado en la spec 001 original (su Acceptance Scenario de duplicados solo cubría el caso "distinto") — se agregó aquí porque reusa el mismo mecanismo de soft-delete que el resto de US2. |

## Sin cambios de contrato para la detección de "varias facturas" (US3)

No hay endpoint nuevo — `varias_facturas` es simplemente un valor más de `Factura.estado`, ya expuesto por `GET /invoices/:id` y `GET /invoices` tal como cualquier otro estado del pipeline (ver `specs/001-captura-facturas/contracts/api.md` § Extracción y corrección).

## Sistema de temas — sin superficie de API

La preferencia de tema (Industry/Nocturne/system) vive enteramente en `localStorage` del navegador (ver `research.md` § 3) — no hay endpoint, campo de sesión, ni dato de servidor asociado.
