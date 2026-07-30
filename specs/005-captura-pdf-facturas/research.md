# Research: Captura de facturas electrónicas en PDF

## 1. Librería para renderizar la primera página de un PDF a imagen

**Decision**: `pdf-to-png-converter`.

**Rationale**: `sharp` (ya usado en todo el pipeline de imagen del proyecto, `image-decoder.ts`) no soporta PDF nativamente — confirmado ([sharp README/issues](https://github.com/lovell/sharp/issues/672); sharp solo procesa JPEG/PNG/WebP/GIF/AVIF/TIFF). `pdf-to-png-converter` envuelve `@napi-rs/canvas`, que trae binarios prebuilt para múltiples plataformas **incluido `darwin-x64`** (confirmado: existe el paquete `@napi-rs/canvas-darwin-x64` en npm) — evita exactamente la clase de problema de compilación nativa que ya afectó este proyecto con `argon2` en el Mac Intel real de Victor (memoria del proyecto). Devuelve un `Buffer` PNG en memoria sin escribir a disco (`returnPageContent: true` es el default), y permite pedir solo una página específica vía `pagesToProcess: [1]` — exactamente lo que necesitan tanto la vista previa como la extracción y el CUFE (que solo miran la primera página, Assumptions del spec).

**Alternatives considered**:
- `unpdf`: su modo "serverless" evita el módulo `canvas` clásico solo para *extracción de texto* — su función `renderPageAsImage` (lo que sí necesitamos) sigue exigiendo el paquete `canvas` clásico (node-canvas) como dependencia, que es justo el tipo de dependencia con compilación nativa frágil (Cairo/Pango) que ya causó fricción en este proyecto — no resuelve el problema real.
- `pdf-to-img`: opción viable de perfil similar; no se profundizó porque `pdf-to-png-converter` ya cumple todos los requisitos con soporte darwin-x64 verificado.
- Enviar el PDF directamente al proveedor de extracción como contenido tipo "document" (algunos proveedores de LLM aceptan PDF nativo): descartado para este MVP — exigiría una rama de código distinta por proveedor (rompe la uniformidad del puerto `InvoiceExtractor`, que hoy solo conoce "imagen"), y de todas formas no resolvería el CUFE por QR (`jsQR` necesita píxeles, no un PDF). Renderizar a imagen una sola vez cubre ambos caminos con un solo mecanismo.

## 2. Punto de integración con el pipeline de extracción ya existente

**Decision**: renderizar el PDF a PNG en memoria justo después de leer el archivo original, tanto en `extraction.processor.ts` (línea donde hoy se lee `factura.rutaImagenOriginal` antes de `decodificarCufeDesdeQr`/`InvoiceExtractor.extract`) como en `ImagenWebService.obtenerParaNavegador` (donde hoy se llama `decodificarImagen(original)` directo). En ambos casos, si el archivo es un PDF, el PNG renderizado reemplaza `imagen`/`original` como si fuera el archivo original leído — el resto de cada función sigue exactamente igual.

**Rationale**: `InvoiceExtractor.extract(image: Buffer)` y `decodificarCufeDesdeQr(imagen: Buffer)` ya reciben un `Buffer` genérico — verificado leyendo el código real de `invoice-extractor.port.ts` y `cufe-decoder.ts`. Esto significa **cero cambios** a los cuatro adaptadores de extracción (`claude-`, `openai-`, `gemini-`, `openai-compatible-invoice-extractor.adapter.ts`) ni al decodificador de CUFE — confirma que la arquitectura hexagonal ya existente (constitution Principio V) hace exactamente lo que promete: el dominio y los adaptadores de extracción nunca se enteran de que el origen fue un PDF en vez de una foto.

**Alternatives considered**: modificar `InvoiceExtractor` para aceptar un PDF directamente y decidir internamente cómo procesarlo — descartado: dispersaría la misma lógica de renderizado en los cuatro adaptadores en vez de resolverla una sola vez antes de que el pipeline exista.

## 3. Detección de que un archivo subido es un PDF

**Decision**: verificar los bytes mágicos del archivo (`%PDF-`, los primeros 5 bytes de todo PDF válido), no la extensión del nombre de archivo ni el `Content-Type` reportado por el navegador.

**Rationale**: mismo criterio de "desconfianza por defecto en la entrada externa" ya aplicado en el proyecto (p. ej. `specs/003-validacion-dian/research.md` sobre no confiar en el nombre de columna de un Excel) — una extensión o `Content-Type` puede venir vacío, incorrecto, o directamente falso, mientras que los bytes mágicos de un PDF real son deterministas y no dependen de lo que el cliente declare.

## 4. Nombre del campo `Factura.rutaImagenOriginal`

**Decision**: se mantiene el nombre actual, sin renombrar a `rutaArchivoOriginal` ni similar.

**Rationale**: ya es funcionalmente genérico — verificado que ningún código fuerza que sea una imagen: `FileStorageService.guardarOriginal()` solo preserva la extensión del archivo subido (sea cual sea), y el endpoint `POST /invoices` (`FilesInterceptor('files')`) no filtra por tipo de archivo. Renombrar la columna exigiría una migración de Prisma únicamente por claridad cosmética, sin ningún cambio de comportamiento — no se justifica para esta feature.

**Alternatives considered**: renombrar a `rutaArchivoOriginal` — descartado por ahora (costo de migración > beneficio cosmético); reconsiderar solo si una futura feature necesita distinguir el tipo de archivo a nivel de columna, no solo por su extensión en disco.

## Sources

- [sharp — High performance Node.js image processing](https://github.com/lovell/sharp)
- [PDF support? · Issue #672 · lovell/sharp](https://github.com/lovell/sharp/issues/672)
- [pdf-to-png-converter (GitHub)](https://github.com/dichovsky/pdf-to-png-converter)
- [@napi-rs/canvas-darwin-x64 (npm)](https://www.npmjs.com/package/@napi-rs/canvas-darwin-x64)
- [unpdf (UnJS)](https://unjs.io/packages/unpdf/)
