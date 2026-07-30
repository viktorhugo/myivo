# Data Model: Captura de facturas electrónicas en PDF

Extiende `specs/001-captura-facturas/data-model.md` (entidad `Factura`) — esta feature no introduce ninguna entidad nueva ni modifica el esquema de base de datos. `Factura.rutaImagenOriginal` ya es funcionalmente genérico (research.md § 4: ningún código fuerza que sea una imagen) y admite la ruta de un PDF sin ninguna migración.

## Sin entidad nueva

Un PDF capturado es, a todos los efectos del dominio, una `Factura` más — mismos campos, misma máquina de estados (`recibida` → `procesando` → `extraída`/`necesita_revisión`/`fallida`/`varias_facturas`, o `extraction_failed` si la extracción no puede interpretar el contenido), misma clasificación de documento, misma regla de elegibilidad. El dominio nunca sabe si el origen fue una foto o un PDF (constitution Principio V) — no hay ningún campo `origenArchivo` ni equivalente.

## `ArchivoDerivado` — nuevo tipo de transformación

El renderizado de la primera página de un PDF a imagen (research.md § 1) encaja en el concepto ya existente de `ArchivoDerivado` (`specs/001-captura-facturas/data-model.md`): un archivo nuevo, vinculado al original, que nunca lo reemplaza (constitution Principio I). No es una entidad nueva — es un valor nuevo de `tipoTransformacion` (p. ej. `'render_pdf_pagina_1'`), mismo mecanismo que ya usan hoy la compresión y la corrección de perspectiva de una foto.

**Validaciones de dominio**:

- El derivado de renderizado MUST generarse solo cuando el archivo original es un PDF (research.md § 3) — para una foto, el pipeline sigue exactamente igual que hoy, sin ningún derivado nuevo de este tipo.
- El derivado de renderizado es la ÚNICA entrada que reciben tanto el decodificador de CUFE (`decodificarCufeDesdeQr`) como el `InvoiceExtractor` cuando el original es un PDF — ninguno de los dos MUST recibir jamás el PDF crudo (no saben leerlo).
- El archivo original (el PDF tal cual se subió) sigue siendo, sin excepción, el único byte-stream que el sistema devuelve cuando se pide el original de esa factura (FR-004, constitution Principio I) — el derivado renderizado es solo para consumo interno del pipeline y para la vista previa en pantalla (FR-005), nunca sustituye al original en ninguna respuesta que declare devolver "el original".

## Relación con `ExtractedInvoiceData` (feature 001)

Sin cambios — el schema Zod de `extractedInvoiceDataSchema` (`packages/domain/src/ports/invoice-extractor.port.ts`) sigue validando la salida del LLM exactamente igual, sin importar si la imagen que se le envió vino de una foto o de un PDF renderizado.
