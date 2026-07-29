# Feature Specification: Reporte anual de compras elegibles para renta

**Feature Branch**: `004-reporte-anual-renta`

**Created**: 2026-07-28

**Status**: Draft

**Input**: User description: "Quiero poder consultar y compartir un reporte anual de mis compras elegibles para la deducción del 1% en renta, en vez de tener que calcularlo yo mismo revisando factura por factura. El criterio de éxito original del MVP (feature 001) ya planteaba esta pregunta: '¿cuánto llevo este año en compras elegibles para la deducción del 1%?'. Hoy el Listado ya muestra un total agregado de 'Compras elegibles' para el año en curso, pero eso es un número suelto en pantalla — no un reporte que se pueda revisar con calma, filtrar por un año distinto al actual, ni entregarle a mi contador como soporte. La constitution (Principio IV) ya es explícita: el sistema informa y organiza, nunca emite conceptos tributarios."

## Clarifications

### Session 2026-07-28

- Q: ¿El archivo exportado incluye el listado de facturas individuales, o solo el resumen agregado? → A: Resumen agregado + una fila por cada factura elegible del año (comercio, fecha, monto, tipo de documento, estado de validación DIAN)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reporte anual consultable en la app (Priority: P1)

Como usuario, quiero ver, para el año gravable que elija, un resumen de mis compras elegibles para la deducción del 1%: el total en COP, cuántas facturas lo componen, y el desglose mes a mes — y poder abrir el listado completo de esas facturas específicas desde ahí, para revisarlas antes de usarlas en mi declaración.

**Why this priority**: Resuelve directamente el criterio de éxito que el propio MVP original (feature 001) dejó planteado y nunca cerró del todo — hoy la respuesta a "¿cuánto llevo este año?" existe como un número suelto en el Listado, sin desglose ni posibilidad de revisar años anteriores. Por sí sola ya entrega el valor central de la feature, sin depender de la exportación (User Story 2).

**Independent Test**: Con un backlog de facturas capturadas que incluya varias marcadas como elegibles en distintos meses de un mismo año, se puede abrir el reporte, elegir ese año, y verificar que el total, el conteo, y el desglose mensual coinciden con la suma real de esas facturas — y que desde ahí se puede llegar al listado filtrado de las mismas.

**Acceptance Scenarios**:

1. **Given** que el usuario abre el reporte por primera vez, **When** no ha elegido ningún año todavía, **Then** el sistema muestra por defecto el año en curso.
2. **Given** que el usuario tiene facturas elegibles capturadas en años anteriores, **When** elige un año distinto al actual, **Then** el reporte recalcula el total, el conteo, y el desglose mensual para ese año elegido.
3. **Given** un año con compras elegibles en varios meses, **When** se muestra el reporte, **Then** el desglose incluye los 12 meses del año, con $0 en los meses sin compras elegibles — no solo los meses que sí tienen datos.
4. **Given** el reporte de un año específico, **When** el usuario decide revisar las facturas que lo componen, **Then** puede abrir el listado completo filtrado exactamente a esas facturas (mismo año, mismas elegibles) sin tener que reconstruir el filtro a mano.
5. **Given** cualquier vista del reporte, **When** el usuario lo mira, **Then** siempre es visible la nota de que es información organizada por el sistema, no un concepto tributario, y que debe revisarse con un contador antes de declarar (constitution Principio IV).
6. **Given** una factura incluida en el reporte, **When** el usuario la revisa, **Then** puede ver si esa factura ya tiene al menos una validación contra la DIAN registrada (feature 003) o no — sin que esto la incluya ni la excluya del reporte.
7. **Given** un año sin ninguna compra elegible, **When** el usuario lo elige, **Then** el reporte muestra $0 y 0 facturas para ese año, sin tratarlo como un error.

---

### User Story 2 - Exportar el reporte fuera de la app (Priority: P2)

Como usuario, quiero poder llevarme el reporte fuera de la app (para dárselo a mi contador o guardarlo como soporte), en vez de tener que mostrarle la pantalla de la aplicación directamente.

**Why this priority**: Es lo que hace que el reporte sirva como soporte real ante un tercero (el contador), pero depende de que el reporte en pantalla (User Story 1) ya exista y esté correcto — sin esa base no hay nada que exportar.

**Independent Test**: Con el reporte de un año ya construido en pantalla (User Story 1), se puede exportarlo y verificar que el archivo resultante contiene el mismo total, conteo, y desglose que se veía en la app, sin necesitar ninguna otra historia.

**Acceptance Scenarios**:

1. **Given** el reporte de un año con datos, **When** el usuario elige exportarlo y selecciona Excel o PDF, **Then** recibe un archivo descargable en el formato elegido con el resumen agregado (total, conteo, desglose mensual) y una fila por cada factura elegible de ese año.
2. **Given** el archivo exportado, **When** el usuario o su contador lo abren, **Then** incluye la misma nota de que es información organizada, no un concepto tributario (mismo requisito que en pantalla).

---

### Edge Cases

- El usuario elige un año futuro (mayor al actual): el reporte se muestra igual, casi siempre vacío ($0, 0 facturas) — no es un caso de error, simplemente no hay datos todavía.
- Una factura elegible está en una moneda distinta a COP: queda fuera del total agregado del reporte, igual que ya ocurre en el Listado (FR-027 de la feature 001) — el reporte no inventa una conversión de moneda.
- Una factura elegible es eliminada (soft-delete, feature 002) después de haber aparecido en un reporte ya exportado previamente: el archivo ya exportado no se actualiza retroactivamente (es una copia fija de un momento dado), pero el reporte visto en pantalla a partir de ese momento ya no la incluye.
- El usuario corrige manualmente un campo de una factura que afecta su elegibilidad (feature 001) después de haber revisado el reporte: el reporte, al volver a abrirse, refleja el nuevo cálculo — no queda una versión vieja cacheada en pantalla.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir al usuario elegir un año gravable para el reporte, mostrando el año en curso por defecto.
- **FR-002**: El sistema MUST calcular, para el año elegido, el total en COP de las facturas ya marcadas como elegibles por la regla de elegibilidad existente (feature 001) — sin reevaluar ni modificar esa clasificación.
- **FR-003**: El sistema MUST mostrar cuántas facturas componen ese total.
- **FR-004**: El sistema MUST mostrar un desglose mes a mes (los 12 meses del año elegido) del total y el conteo de compras elegibles.
- **FR-005**: El sistema MUST permitir abrir, desde el reporte, el listado completo de las facturas elegibles del año elegido.
- **FR-006**: El sistema MUST mostrar, para cada factura del reporte, si ya cuenta con al menos una validación DIAN registrada (feature 003).
- **FR-007**: El sistema MUST incluir siempre, en cualquier presentación del reporte (pantalla o exportado), la nota de que es información organizada por el sistema, no un concepto tributario, y que debe revisarse con el usuario o su contador (constitution Principio IV).
- **FR-008**: El sistema MUST excluir del reporte cualquier factura eliminada (soft-delete, feature 002), igual que el resto de las vistas de la aplicación.
- **FR-009**: El total agregado del reporte MUST incluir únicamente documentos en la moneda por defecto (COP); los documentos elegibles en otras monedas MUST quedar fuera de ese total, igual que ya ocurre en el Listado (FR-027 de la feature 001).
- **FR-010**: El sistema MUST permitir exportar el reporte de un año a un archivo descargable, en Excel (.xlsx) o en PDF — el usuario elige cuál de los dos formatos quiere en cada exportación. El archivo MUST incluir el resumen agregado (total, conteo, desglose mensual) y, además, una fila por cada factura elegible del año (comercio, fecha, monto, tipo de documento, y si ya tiene al menos una validación DIAN registrada) — no solo el resumen agregado, para que sirva como soporte real. MUST incluir siempre la nota de la constitution Principio IV.

### Key Entities *(include if feature involves data)*

Esta feature no introduce ninguna entidad de datos nueva — el "Reporte Anual" es una vista calculada sobre los datos ya existentes de `Factura` (feature 001), sin persistir nada nuevo. Ver `specs/001-captura-facturas/data-model.md` para la entidad `Factura` y sus campos de elegibilidad, y `specs/003-validacion-dian/data-model.md` para `ValidacionDian`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El usuario puede responder "¿cuánto llevo este año en compras elegibles?" sin hacer ningún cálculo manual, en menos de 5 segundos desde que abre el reporte.
- **SC-002**: El usuario puede consultar el mismo resumen para cualquier año anterior en el que tenga facturas capturadas, con la misma facilidad que para el año en curso.
- **SC-003**: El usuario puede entregarle a su contador un soporte del reporte sin tener que compartir acceso a la aplicación ni tomar capturas de pantalla manualmente.
- **SC-004**: El total y el conteo mostrados en el reporte siempre coinciden exactamente con la suma real de las facturas elegibles de ese año — sin discrepancias entre lo que muestra el reporte y lo que muestra el Listado filtrado al mismo año.

## Assumptions

- El año gravable se asume igual al año calendario (1 de enero a 31 de diciembre) — así funciona la declaración de renta de personas naturales en Colombia, y es consistente con cómo el Listado ya agrupa "Compras elegibles · [año]" hoy.
- El desglose mensual siempre muestra los 12 meses del año elegido, incluyendo los que no tienen compras elegibles (en $0), en vez de omitirlos — más simple y predecible que una lista variable según los datos.
- Esta feature depende de que ya existan facturas capturadas y clasificadas por elegibilidad (feature 001) — no introduce ningún mecanismo nuevo de captura, extracción, ni cálculo de elegibilidad.
- El estado de validación DIAN (FR-006) es solo informativo dentro del reporte — no condiciona si una factura se incluye o se excluye del total.
- La exportación en dos formatos (FR-010) implica más esfuerzo de implementación que uno solo — Excel ya no requiere ninguna dependencia nueva (`exceljs` ya está instalado desde la feature 003), pero PDF sí requerirá evaluar una librería de generación de PDF en `/speckit-plan`.
- Fuera de alcance de esta feature: cualquier cálculo de impuesto, generación de borrador de declaración de renta, o interacción con los formularios/servicios de la DIAN para declarar (constitution Principio IV); multi-usuario o cuentas de contador con acceso propio a la aplicación; y cualquier modificación a la regla de elegibilidad tributaria ya existente (feature 001) — este reporte consume esa clasificación, no la cambia.
