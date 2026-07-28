# Feature Specification: Validación y conciliación contra la DIAN

**Feature Branch**: `003-validacion-dian`

**Created**: 2026-07-28

**Status**: Draft

**Input**: User description: "Quiero poder validar/conciliar mis facturas ya capturadas contra la DIAN, para confirmar que el CUFE que el sistema extrajo (por QR o por OCR de respaldo) corresponde realmente a un documento electrónico válido y vigente, en vez de confiar únicamente en lo que leí de la imagen. El sistema ya extrae el CUFE/CUDE de cada factura y lo usa para clasificar el tipo de documento y calcular la elegibilidad tributaria (feature 001), pero nunca lo confirma contra la fuente oficial. La constitution (Principio VI — 'Validación DIAN sin Trampas') ya define cómo debe hacerse esto: de forma asistida, nunca automatizada."

## Clarifications

### Session 2026-07-28

- Q: ¿Cuál es el conjunto de opciones que el usuario puede reportar como resultado de una validación manual? → A: Válido y vigente / No encontrado / Anulado o reemplazado / Otro
- Q: ¿En qué formato aporta el usuario el documento de conciliación en lote? → A: El archivo tal cual lo exporta el portal de la DIAN (no un CSV/Excel definido por este sistema)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Validación asistida de un documento individual (Priority: P1)

Como usuario, para una factura con CUFE ya extraído, quiero que el sistema me dé un enlace directo a la consulta de la DIAN con el CUFE precargado, para no tener que copiarlo/pegarlo a mano. Después de revisar el resultado en el portal de la DIAN (fuera de la app), quiero volver a la app y registrar qué encontré, para que quede guardado con fecha y trazabilidad, y pueda verlo después en el Detalle y en el Listado de esa factura.

**Why this priority**: Es el núcleo de la feature — sin esto no existe ninguna forma de confirmar un CUFE contra la fuente oficial. Por sí sola ya resuelve el problema declarado ("confirmar que el CUFE corresponde a un documento real y vigente"), sin depender de ninguna otra historia.

**Independent Test**: Con una factura que ya tiene CUFE, se puede abrir su Detalle, obtener el enlace de consulta, y registrar un resultado — verificando de forma aislada que queda guardado con fecha, método y el resultado reportado, visible después en Detalle y Listado.

**Acceptance Scenarios**:

1. **Given** una factura con CUFE ya extraído (por QR o por OCR), **When** el usuario abre la acción de validación DIAN en su Detalle, **Then** el sistema muestra un enlace a la consulta oficial de la DIAN con el CUFE ya precargado, listo para abrir.
2. **Given** que el usuario ya visitó ese enlace y revisó el resultado en el portal de la DIAN, **When** vuelve a la app y registra lo que encontró, **Then** el sistema guarda el resultado junto con la fecha de la consulta y el método ("manual"), y dicho registro es visible en el Detalle de esa factura.
3. **Given** una factura ya validada, **When** el usuario consulta el Listado, **Then** puede distinguir de un vistazo cuáles facturas ya fueron validadas contra la DIAN y cuáles no.
4. **Given** una factura sin CUFE (p. ej. un tiquete POS), **When** el usuario mira su Detalle, **Then** no se le ofrece la acción de validación DIAN — no es un error, es una condición normal (no hay CUFE que validar).
5. **Given** una factura ya validada anteriormente, **When** el usuario decide volver a consultarla, **Then** puede repetir el proceso y el nuevo resultado reemplaza o se agrega al historial de validaciones de esa factura (ver Assumptions).

---

### User Story 2 - Conciliación en lote contra un documento descargado de la DIAN (Priority: P2)

Como usuario, quiero poder aportar un documento que yo mismo descargué desde mi portal DIAN (con mis documentos electrónicos recibidos), para que el sistema concilie automáticamente cuáles de mis facturas ya capturadas coinciden con ese documento oficial, sin tener que validar una por una cuando tengo muchas.

**Why this priority**: Ahorra tiempo real cuando el backlog de facturas es grande, pero depende de que el usuario ya sepa descargar ese documento por su cuenta y de que exista al menos una factura capturada (User Story 1 del feature 001) — no es indispensable para el valor central de la feature, que ya lo entrega la User Story 1 de esta misma feature.

**Independent Test**: Con un documento de ejemplo descargado de la DIAN y al menos una factura capturada cuyo CUFE aparezca en ese documento, se puede aportar el documento y verificar que el sistema marca esa factura como conciliada, con fecha y método ("conciliación"), sin necesitar la User Story 1.

**Acceptance Scenarios**:

1. **Given** un documento descargado del portal DIAN que contiene el CUFE de una factura ya capturada, **When** el usuario lo aporta al sistema, **Then** la factura correspondiente queda marcada como conciliada, con fecha de la conciliación y un snapshot de los metadatos observados en ese documento.
2. **Given** un documento aportado que no contiene el CUFE de ninguna factura ya capturada, **When** se procesa, **Then** el sistema informa que no encontró coincidencias, sin marcar nada como conciliado.
3. **Given** un documento aportado con un formato que el sistema no reconoce, **When** se procesa, **Then** el sistema lo rechaza con un mensaje claro, sin inventar ni asumir datos que no pudo leer.

---

### Edge Cases

- CUFE marcado por la DIAN como "no encontrado" o inválido: el usuario lo registra igual (no es un error del sistema) — queda visible como una señal de alerta sobre esa factura, distinta de "validado como correcto".
- El usuario reporta un resultado y luego se da cuenta de que se equivocó al leerlo: puede volver a registrar un nuevo resultado sobre la misma factura (ver User Story 1, Acceptance Scenario 5).
- Dos facturas capturadas por separado comparten el mismo CUFE (ya detectado como duplicado por la feature 001): validar una no valida automáticamente la otra — son registros independientes aunque compartan CUFE.
- El documento de conciliación en lote incluye un CUFE que no corresponde a ninguna factura capturada en este sistema: se ignora esa entrada, no genera ningún registro nuevo (esta feature no crea facturas, solo valida las que ya existen).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST ofrecer, para cualquier factura con CUFE no nulo, un enlace de consulta al portal oficial de la DIAN con ese CUFE precargado.
- **FR-002**: El sistema MUST NOT realizar ninguna consulta automatizada al portal de la DIAN, ni evadir ni interactuar con ningún mecanismo de verificación humana (captcha) que ese portal use (constitution Principio VI).
- **FR-003**: El sistema MUST permitir al usuario registrar manualmente el resultado que observó al visitar el enlace de la DIAN para una factura dada, eligiendo entre un conjunto cerrado de opciones: "Válido y vigente", "No encontrado", "Anulado o reemplazado", u "Otro".
- **FR-004**: Todo resultado de validación registrado MUST guardar como mínimo: la fecha/hora de la consulta, el método usado ("manual" o "conciliación"), y un snapshot de los metadatos observados en ese momento.
- **FR-005**: El sistema MUST NOT ofrecer la acción de validación DIAN sobre una factura cuyo CUFE sea nulo.
- **FR-006**: El sistema MUST mostrar, tanto en el Detalle como en el Listado de facturas, si una factura ya cuenta con al menos una validación registrada y cuál fue su resultado más reciente.
- **FR-007**: El sistema MUST permitir al usuario aportar el documento tal cual lo exporta el propio portal de la DIAN (no un formato intermedio definido por este sistema), para conciliar en lote contra las facturas ya capturadas.
- **FR-008**: Al conciliar en lote, el sistema MUST marcar como conciliada cada factura capturada cuyo CUFE aparezca en el documento aportado, y MUST NOT marcar ni modificar ninguna factura cuyo CUFE no aparezca ahí.
- **FR-009**: El sistema MUST rechazar con un mensaje claro cualquier documento de conciliación que no pueda interpretar, sin inventar coincidencias.
- **FR-010**: El sistema MUST conservar el historial completo de validaciones de una factura (no solo la más reciente) — ver Assumptions sobre cómo se expone ese historial.

### Key Entities *(include if feature involves data)*

- **Validación DIAN**: Un registro de que el usuario (o el proceso de conciliación) confirmó el estado de un CUFE contra la fuente oficial. Incluye: la factura a la que pertenece, el método usado (manual / conciliación), la fecha/hora, el resultado reportado (uno de: "Válido y vigente", "No encontrado", "Anulado o reemplazado", "Otro"), y un snapshot de los metadatos observados. Una factura puede tener cero, una, o varias validaciones a lo largo del tiempo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El usuario puede iniciar la validación de una factura individual (obtener el enlace) en menos de 5 segundos desde que abre su Detalle.
- **SC-002**: El usuario puede registrar el resultado de una consulta ya hecha en el portal de la DIAN en menos de 3 interacciones (por ejemplo: abrir la acción, elegir el resultado, confirmar).
- **SC-003**: Con un documento real de conciliación descargado de la DIAN, el usuario puede conciliar su backlog completo de facturas capturadas en una sola operación, en vez de una por una.
- **SC-004**: El usuario puede responder, para cualquier factura, la pregunta "¿esto ya lo confirmé contra la DIAN, y qué encontré?" sin salir del Detalle de esa factura.

## Assumptions

- El documento de conciliación en lote es el que el propio portal de la DIAN permite exportar/descargar (no un formato intermedio inventado por este sistema) — el esquema exacto (columnas, extensión de archivo) no se fija en este spec porque depende del formato real que el portal ofrezca hoy; se investiga y documenta en `research.md` durante `/speckit-plan`, y FR-009 ya cubre el caso de que el sistema no pueda interpretarlo.
- El historial de validaciones (FR-010) se conserva de forma append-only (nunca se sobrescribe un registro anterior); la UI puede optar por mostrar solo la más reciente de forma prominente y el resto en un historial secundario — el detalle de esa UI es una decisión de diseño, no de alcance.
- Esta feature depende de que la factura ya tenga un CUFE extraído por la feature 001 (captura de facturas) — no introduce ningún mecanismo nuevo de extracción de CUFE.
- El enlace a la DIAN es siempre abierto por el usuario en su propio navegador/dispositivo, fuera del control de la aplicación — la app no necesita (ni debe) embeber el portal de la DIAN dentro de sí misma vía iframe u otro mecanismo similar, ya que eso podría interpretarse como automatización o scraping.
- Fuera de alcance de esta feature: cualquier automatización o scraping del portal de la DIAN (prohibido por constitution Principio VI, ver FR-002); reportes anuales para declaración de renta (feature futura separada); soporte multi-usuario.
