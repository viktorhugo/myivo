# Research: Validación y conciliación contra la DIAN

## 1. Enlace de consulta individual de CUFE (US1, FR-001)

**Decision**: El enlace se construye como `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey={CUFE}`.

**Rationale**: Confirmado por dos fuentes independientes:
1. Documentación de integradores de facturación electrónica en Colombia, que documentan explícitamente el formato `catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=CUFE` (entorno de producción) y su equivalente de pruebas `catalogo-vpfe-hab.dian.gov.co`.
2. El propio código de este proyecto (`apps/api/src/modules/extraction/cufe-decoder.ts`, feature 001, ya implementado): al decodificar el QR de una factura electrónica colombiana, ya asume y maneja este mismo patrón — "el QR... suele codificar una URL del catálogo DIAN con el CUFE como query param (`documentkey` o `cufe`)". Esto es evidencia interna independiente de que el patrón es real y ya se usa en producción de facturación electrónica colombiana, no una suposición nueva para esta feature.

**Riesgo documentado, no ignorado**: El propio comentario de `cufe-decoder.ts` ya advierte que "el formato exacto varía entre proveedores tecnológicos de facturación". El portal es de un tercero (la DIAN) fuera de nuestro control, y no se pudo confirmar mediante fetch directo si el campo de búsqueda del formulario efectivamente se autocompleta al cargar la URL con ese query param (la página requiere JavaScript para eso, que una petición HTTP simple no ejecuta). **Mitigación de diseño**: el enlace se ofrece como mejora — si el parámetro no precarga el campo, el usuario igual llega directo a la página correcta del catálogo, y la UI muestra el CUFE en texto plano junto a un botón "copiar" para que el peor caso siga siendo "un clic para copiar, pegar a mano", nunca peor que la situación actual (sin ningún enlace).

**Alternatives considered**:
- Enviar solo el CUFE sin ningún enlace, dejando que el usuario navegue manualmente al portal: descartado porque no reduce fricción, que es el problema declarado en la User Story.
- Intentar automatizar la consulta y traer el resultado a la app: descartado de forma terminante — prohibido por constitution Principio VI (evadir/automatizar contra un portal que usa captcha).

## 2. Snapshot de metadatos de una validación (FR-004)

**Decision**: El "snapshot" es una copia de los campos clave de la Factura *tal como estaban en el momento de la validación* (comercioNombre, totalCentavos, moneda, fechaHoraCompra, cufe) — no datos extraídos del portal de la DIAN.

**Rationale**: La validación manual (US1) no involucra ninguna automatización que pueda "leer" datos del portal de la DIAN (eso sería scraping, prohibido). Lo único que el sistema puede capturar honestamente en ese momento es el estado de sus propios datos. Esto es coherente con el patrón ya usado en el proyecto para `ExtraccionCruda` (constitution Principio III: preservar un snapshot para trazabilidad/auditoría) — aquí el propósito es poder responder después "¿la factura tenía estos datos cuando la validé, o cambiaron desde entonces?", útil si el usuario corrige un campo tras validar.

**Alternatives considered**:
- Pedirle al usuario que escriba una nota de texto libre sobre lo que vio: descartado como *requisito* (fricción innecesaria, viola SC-002 de ≤3 interacciones) pero puede ofrecerse como campo *opcional* — decisión de UI, no de esta fase.

## 3. Formato del documento de conciliación en lote (US2, FR-007)

**Decision**: Formato Excel (`.xlsx`), tal como lo exporta el portal "Facturando Electrónicamente" de la DIAN (sección de documentos recibidos, filtrable por NIT/rango de fechas). Las columnas exactas (nombres de cabecera) **no se fijan en esta fase** — se confirman con un archivo de ejemplo real antes de implementar el parser (ver Assumptions actualizada).

**Rationale**: Múltiples fuentes de terceros (firmas contables, proveedores de software de facturación) confirman que la DIAN permite exportar en Excel un listado de documentos electrónicos recibidos/emitidos, filtrable por NIT del receptor y rango de fechas. No fue posible confirmar las columnas exactas (nombres de cabecera, orden) sin acceso autenticado al portal transaccional de un contribuyente real — inventar nombres de columna específicos sin verificarlos sería introducir un defecto silencioso (un parser que "funciona" contra una suposición pero falla contra el archivo real).

**Mitigación de diseño**: el parser MUST buscar, dentro de las cabeceras del Excel, una columna cuyo nombre coincida (con tolerancia a mayúsculas/variaciones menores) con "CUFE" o "CUDE", en vez de asumir una posición fija de columna. Si no encuentra ninguna columna reconocible, falla explícitamente (FR-009) en vez de adivinar. Antes de `/speckit-tasks`, se recomienda que el usuario aporte un archivo de ejemplo real (puede ser un extracto con datos anonimizados) para confirmar el esquema exacto — de lo contrario, la tarea de implementación del parser debe incluir su propia validación exploratoria como primer paso.

**Alternatives considered**:
- Pedir al usuario que prepare un CSV simplificado con solo una columna de CUFE: era la opción recomendada originalmente en `/speckit-clarify`, pero el usuario explícitamente prefirió el archivo nativo de la DIAN (más fiel, sin paso manual de preparación) — ver `spec.md` § Clarifications.

## 4. Librería para leer archivos Excel (.xlsx) en Node.js

**Decision**: `exceljs`.

**Rationale**: Librería madura, con mantenimiento activo y sin el historial de advisories de seguridad (ReDoS) que ha afectado a versiones del paquete `xlsx` (SheetJS) distribuido vía npm — relevante porque este archivo viene de una fuente externa (el propio usuario, pero el contenido lo genera el portal de la DIAN) y MUST tratarse como entrada no confiable antes de parsear (constitution Principio III, aplicado aquí por analogía: nunca confiar ciegamente en una entrada externa).

**Alternatives considered**:
- `xlsx` (SheetJS): igual de capaz para lectura simple, pero con historial de vulnerabilidades no parcheadas en la distribución de npm (el propio proyecto SheetJS recomienda instalar desde su CDN en vez de npm por esto) — evitado por Principio VII (postura de seguridad conservadora en un sistema personal sin equipo de seguridad dedicado).

## Sources

- [Buscar Factura por CUFE en la DIAN: Consulta en 1 Minuto (2026)](https://tramitesdian.co/dian-en-colombia/cufe-dian/buscar-factura/)
- [Páginas - Para los compradores (DIAN oficial)](https://www.dian.gov.co/impuestos/factura-electronica/como-hacerlo/Paginas/para-los-compradores.aspx)
- [¿Cómo descargar listados en la DIAN? (Alegra)](https://ayuda.alegra.com/col/descargar-listados-en-la-dian)
- [Consultar y descargar facturas electronicas recibidas (consultorcontable.com)](https://www.consultorcontable.com/consultar-y-descargar-facturas-electronicas-recibidas/)
- `apps/api/src/modules/extraction/cufe-decoder.ts` (evidencia interna del proyecto, feature 001)
