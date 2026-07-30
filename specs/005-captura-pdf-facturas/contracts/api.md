# API Contract: Captura de facturas electrónicas en PDF

Extiende `specs/001-captura-facturas/contracts/api.md` — esta feature **no cambia la forma de ningún endpoint existente**. Documentado aquí explícitamente porque es una consecuencia deliberada del diseño (research.md § 2, § 4), no una omisión.

## `POST /invoices` — sin cambios de contrato

Ya acepta cualquier tipo de archivo en el campo `files` — verificado contra el código real: `@UseInterceptors(FilesInterceptor('files'))` en `invoices.controller.ts` no define ningún `fileFilter` por extensión ni `Content-Type`. Un PDF se sube exactamente por el mismo request multipart que ya usa una foto, sin ningún parámetro nuevo. La respuesta (`Factura[]`) tampoco gana ningún campo nuevo — FR-010 del spec: sin distinción de comportamiento por origen.

## `GET /invoices/:id/image?variant=web` — mismo contrato, origen interno distinto

Sigue devolviendo un JPEG (`Content-Type: image/jpeg`), igual que hoy. Cuando el original de esa factura es un PDF, el JPEG servido es la primera página renderizada (research.md § 1) en vez de la foto directamente — el cliente (frontend) no necesita ningún cambio para consumir este endpoint, ya que la forma de la respuesta es idéntica.

## `GET /invoices/:id/image` (sin `variant=web`, archivo original) — sin cambios

Sigue devolviendo el byte-stream original tal cual (constitution Principio I) — para una factura capturada desde un PDF, esto es el PDF crudo, con su `Content-Type` correspondiente (`application/pdf`, ya resuelto por `mimeTypeDeArchivo()` a partir de la extensión del archivo en disco, sin cambios a esa función).

## Validación en el momento de subir — comportamiento nuevo, sin nuevo endpoint

FR-008 del spec: un archivo con extensión `.pdf` que no son bytes de PDF válidos (research.md § 3) sigue el mismo camino que hoy sigue una imagen corrupta — la factura se crea igual (nunca bloquea la ingesta, constitution Principio III), y la extracción posterior la deja en `extraction_failed`. No hay una validación síncrona nueva en `POST /invoices` que rechace el archivo en el momento de subir.
