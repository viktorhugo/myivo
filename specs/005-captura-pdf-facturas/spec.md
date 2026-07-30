# Feature Specification: Captura de facturas electrónicas en PDF

**Feature Branch**: `005-captura-pdf-facturas`

**Created**: 2026-07-29

**Status**: Draft

**Input**: User description: "Quiero poder capturar una factura electrónica a partir del PDF que me llega por correo, en vez de tener que imprimirla y fotografiarla para poder usarla en el sistema. El spec original del MVP (feature 001) ya dejó esto anotado como 'deseable después' en su sección de fases futuras: 'Extracción desde PDF de facturas electrónicas recibidas por correo'. Hoy el sistema solo acepta fotos/imágenes de facturas físicas — una factura electrónica que llega directo por correo como PDF no tiene ningún camino de captura salvo imprimirla y fotografiarla, lo cual es absurdo (ya es un documento digital) y además degrada la calidad de la evidencia (constitution Principio I). El PDF subido debe ser el archivo original, la extracción debe intentar obtener el CUFE por el mismo camino preferido de hoy (decodificación de QR), y si falla debe caer a extraction_failed como cualquier foto ilegible — todo desde el mismo flujo de captura que ya existe hoy para fotos."

## Clarifications

### Session 2026-07-29

- Q: ¿Qué pasa cuando la misma compra real llega dos veces por canales distintos — una foto del recibo físico y, después, el PDF de la factura electrónica por correo? → A: Igual que hoy: se marca como "posible duplicado" (mismo criterio de comercio+fecha+total, feature 001/002), el usuario decide manualmente cuál conservar — sin tratamiento especial por ser PDF vs foto.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Subir un PDF y que quede capturado de inmediato (Priority: P1)

Como usuario, quiero subir el PDF de una factura electrónica tal cual me llegó por correo (sin imprimirlo ni fotografiarlo) desde el mismo flujo de captura que ya uso para fotos, y que el sistema lo guarde de inmediato como evidencia — sin depender de que el procesamiento posterior funcione.

**Why this priority**: Es el mismo principio fundacional que ya estableció la User Story 1 de la feature 001 ("capturar sin depender del procesamiento") aplicado al nuevo tipo de archivo — resuelve por sí sola el problema central ("ya no tengo que imprimir ni fotografiar una factura que ya es digital"), incluso antes de que la extracción sepa interpretar un PDF.

**Independent Test**: Se puede probar subiendo uno o varios PDFs de factura electrónica desde la pantalla de captura existente y verificando que cada uno queda guardado, visible en el Listado con su propio estado, y que el archivo original se puede recuperar íntegro — sin que la extracción tenga que haber terminado ni tenido éxito.

**Acceptance Scenarios**:

1. **Given** que el usuario está en la pantalla de captura que ya existe para fotos, **When** selecciona un archivo PDF en vez de una imagen, **Then** el sistema lo acepta por el mismo flujo, sin pantalla ni botón separado.
2. **Given** un PDF de factura electrónica, **When** el usuario lo sube, **Then** el sistema lo guarda de inmediato como el archivo original de esa factura, inmutable (constitution Principio I) — igual que ya hace con una foto.
3. **Given** que el usuario tiene varios PDFs para subir, **When** los selecciona todos a la vez, **Then** el sistema los acepta en una sola operación — igual que ya permite con varias fotos.
4. **Given** una factura capturada a partir de un PDF, **When** el usuario pide ver el archivo original, **Then** el sistema devuelve el mismo PDF que se subió, sin ninguna modificación.

---

### User Story 2 - Extraer y clasificar los datos del PDF (Priority: P2)

Como usuario, quiero que el PDF que subí se procese igual que una foto: que el sistema extraiga el comercio, la fecha, los montos, el CUFE y demás campos, y que lo clasifique tributariamente con la misma regla de elegibilidad ya existente — para no tener que digitar nada a mano ni tratar un PDF como un caso aparte.

**Why this priority**: Depende de que el PDF ya esté capturado (User Story 1); es la parte que convierte "un archivo guardado" en "un registro útil para la declaración de renta", pero el sistema ya es funcional y da valor real sin ella (el archivo queda seguro y disponible para reintento).

**Independent Test**: Con un PDF de factura electrónica ya capturado (User Story 1), se puede disparar o esperar el procesamiento y verificar que el registro termina con los mismos campos que produciría una foto nítida equivalente, incluida la clasificación de elegibilidad — sin necesitar ninguna otra historia.

**Acceptance Scenarios**:

1. **Given** un PDF recién capturado, **When** el sistema lo procesa, **Then** extrae los mismos campos que extraería de una foto (comercio, fecha, montos, ítems, CUFE) usando el mismo pipeline de extracción ya existente.
2. **Given** un PDF cuyo documento incluye el código QR de la DIAN renderizado visualmente, **When** el sistema busca el CUFE, **Then** lo intenta obtener primero por decodificación de ese QR (mismo camino preferido de hoy, constitution Principio III) antes de recurrir a cualquier otro método.
3. **Given** una factura extraída de un PDF, **When** el sistema evalúa su elegibilidad tributaria, **Then** aplica exactamente la misma regla ya existente (feature 001) — sin ninguna regla distinta por venir de un PDF en vez de una foto.
4. **Given** un PDF ilegible, corrupto, o cuyo contenido no se puede interpretar, **When** el sistema intenta procesarlo, **Then** el documento queda en el estado `extraction_failed`, disponible para reintento — nunca bloquea ni pierde la captura (constitution Principio III).

---

### Edge Cases

- Un PDF de más de una página: el sistema usa la primera página como fuente de extracción por defecto (Assumptions) — no es un caso de error.
- Un PDF protegido con contraseña (frecuente en facturas electrónicas de servicios públicos en Colombia): no se maneja de forma especial en esta fase — cae a `extraction_failed` como cualquier archivo no legible (Assumptions).
- Un PDF que en realidad es una foto escaneada de un papel, no una factura electrónica nativa: se trata igual que cualquier imagen de mala calidad — puede extraerse con éxito, o caer a `extraction_failed`/`necesita_revisión` según lo que el pipeline logre leer, sin tratamiento especial por ser técnicamente un PDF.
- Un archivo con extensión `.pdf` que en realidad no es un PDF válido (corrupto o renombrado): el sistema lo rechaza o lo deja en `extraction_failed`, igual que ya hace con un archivo de imagen inválido.
- Un PDF que no es ninguna factura (el usuario subió el archivo equivocado): igual que hoy con una foto irrelevante — se captura igual, y la extracción/clasificación reflejará que no hay datos de factura reales que extraer.
- La misma compra real capturada dos veces por canales distintos (foto del recibo físico y, después, el PDF de la factura electrónica del mismo comercio/fecha/total): el sistema lo detecta con la misma regla de "posible duplicado" ya existente (feature 001/002) y el usuario resuelve manualmente cuál conservar — sin ninguna lógica nueva que decida automáticamente que el PDF es "mejor" que la foto (Clarifications, sesión 2026-07-29).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir subir un archivo PDF desde el mismo flujo de captura ya existente para fotos — mismo botón/pantalla, sin una ruta de carga separada.
- **FR-002**: El sistema MUST guardar el PDF subido como el archivo original de esa factura, inmutable (constitution Principio I) — igual que ya hace con una foto.
- **FR-003**: El sistema MUST permitir subir varios PDFs a la vez en una sola operación, igual que ya permite con varias fotos.
- **FR-004**: El sistema MUST poder devolver, para una factura capturada desde un PDF, el byte-stream del PDF original tal como fue ingresado, sin modificar (constitution Principio I).
- **FR-005**: El sistema MUST poder mostrar una vista previa navegable del PDF capturado (Listado y Detalle) equivalente a la que ya muestra para una foto, sin exigir que el usuario descargue el PDF para verlo.
- **FR-006**: El sistema MUST intentar extraer del PDF los mismos campos que extraería de una foto (comercio, fecha, montos, ítems, medio de pago, CUFE, etc.), usando el mismo pipeline de extracción ya existente (feature 001).
- **FR-007**: El sistema MUST intentar obtener el CUFE de un PDF por el mismo camino preferido ya existente (decodificación determinística de un código QR presente en el documento) antes de recurrir a cualquier método de respaldo (constitution Principio III).
- **FR-008**: Si la extracción de un PDF falla, el sistema MUST dejarlo en el estado `extraction_failed`, disponible para reintento — un PDF ilegible o corrupto MUST NOT bloquear ni perder la ingesta (constitution Principio III).
- **FR-009**: El sistema MUST clasificar tributariamente una factura extraída de un PDF con exactamente las mismas reglas de elegibilidad y clasificación de documento ya existentes (feature 001) — sin reglas nuevas ni distintas según el tipo de archivo de origen.
- **FR-010**: El sistema MUST tratar una factura capturada desde un PDF igual que una capturada desde una foto en el resto de funcionalidades ya existentes (Listado, filtros, duplicados, validación DIAN, reporte anual) — sin ninguna distinción de comportamiento por su origen.

### Key Entities *(include if feature involves data)*

Esta feature no introduce ninguna entidad nueva — extiende la entidad `Factura` ya existente (feature 001) para admitir un PDF como archivo original, además de una imagen. La vista previa renderizada del PDF encaja en el concepto ya existente de `ArchivoDerivado` (constitution Principio I: un derivado nunca reemplaza al original, siempre queda vinculado a él) — mismo mecanismo que ya usan hoy la compresión y corrección de perspectiva de una foto.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El usuario puede subir un PDF de factura electrónica y verlo aparecer en su Listado, con su propio estado, en menos de 1 minuto desde que lo selecciona.
- **SC-002**: Un PDF de factura electrónica nítido logra extraer sus datos principales (comercio, fecha, monto, CUFE) sin corrección manual en al menos la misma proporción de casos que ya logra hoy una foto nítida (>80%, mismo criterio de éxito del MVP original, feature 001).
- **SC-003**: El usuario ya no necesita imprimir ni fotografiar ninguna factura electrónica que reciba por correo para poder capturarla en el sistema.

## Assumptions

- Un PDF de una sola página es el caso típico esperado; para un PDF de varias páginas, el sistema usa la primera página como fuente de extracción y de vista previa por defecto.
- Un PDF protegido con contraseña no se maneja de forma especial en esta fase (no hay flujo para pedir/ingresar la contraseña) — queda documentado como limitación conocida, igual que el esquema de columnas del Excel de conciliación quedó documentado como limitación conocida en la feature 003.
- El campo que hoy guarda la ruta del archivo original de una factura puede necesitar generalizarse (de "imagen" a "archivo") para admitir un PDF sin cambiar su propósito — el original sigue siendo siempre el byte-stream inmutable tal como se subió; el nombre/tipo exacto de ese cambio es una decisión técnica para `/speckit-plan`.
- Reusa el mismo mecanismo de subida, autenticación, y límites de tamaño de archivo ya existentes para fotos — sin infraestructura nueva.
- Esta feature depende de que ya exista el pipeline de extracción y clasificación de la feature 001 — no introduce un pipeline de extracción alternativo, solo un nuevo tipo de archivo de entrada para el mismo pipeline.
- Fuera de alcance: parsear el adjunto XML/UBL de la DIAN que a veces acompaña la factura electrónica (integración distinta, mucho más profunda); cualquier cambio a las reglas de elegibilidad tributaria o clasificación de documento ya existentes (feature 001); detección/conversión especial si el PDF subido es en realidad una foto escaneada; multi-usuario o cualquier cambio al modelo de un solo usuario (constitution Principio VII).
