# Feature Specification: Rediseño visual — temas Industry/Nocturne

**Feature Branch**: `002-rediseno-visual-web`

**Created**: 2026-07-27

**Status**: Draft

**Input**: User description: "Rediseñar visualmente la app web existente (apps/web) usando un sistema de diseño de alta fidelidad ya validado (handoff con README + HTML), como re-skin de la web existente — no una app nativa. Dos temas intercambiables (Industry claro, Nocturne oscuro) sobre las 5 pantallas existentes (Captura, Detalle, Listado, Confirmación de duplicado, y una nueva de Estado vacío), sin tocar la lógica de negocio ya implementada. Incluye completar dos requisitos ya aprobados en la feature 001 pero nunca construidos: eliminar factura (soft-delete sin purga automática, FR-029) y detección de varias facturas en una foto (FR-028)."

## Clarifications

### Session 2026-07-27

- Q: Cuando el sistema detecta "varias facturas en una foto" (US3), ¿qué pasa exactamente con el registro de `Factura`? → A: Se reutiliza el mismo registro que ya se crea al subir la foto — pasa a un nuevo valor de estado ("varias_facturas") dentro de la máquina de estados existente, sin datos extraídos poblados.
- Q: Cuando el usuario elimina (soft-delete) una factura, ¿sigue siendo accesible por su identificador directo (ej. un enlace guardado a `GET /invoices/:id`)? → A: Queda inaccesible por las vías normales (comportamiento equivalente a "no encontrado") — solo recuperable directamente en el almacenamiento/base de datos, no por ningún endpoint actual.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sistema de diseño visual con dos temas (Priority: P1) 🎯 MVP visual

Como usuario, quiero que la app se vea y se sienta como el diseño de referencia validado (tema claro "Industry" o tema oscuro "Nocturne", a mi elección), aplicado a las pantallas de captura, detalle y listado que ya uso, para tener una experiencia visual coherente y profesional en vez de los estilos básicos actuales.

**Why this priority**: Es el valor central de toda la feature — sin el sistema de temas funcionando sobre las pantallas principales, el resto de historias (estado vacío, refinamiento del bottom sheet) no tienen sistema de diseño sobre el cual apoyarse.

**Independent Test**: Cambiar el tema (claro/oscuro/según sistema) desde un selector visible, navegar por Captura → Listado → Detalle, y confirmar que colores, tipografía, iconografía, radios de esquina y tratamiento de tarjetas coinciden con los tokens de cada tema en las tres pantallas, sin que ningún dato ni funcionalidad existente (extracción, filtros, corrección manual, elegibilidad) se vea afectado.

**Acceptance Scenarios**:

1. **Given** el usuario nunca ha elegido un tema, **When** abre la app, **Then** se aplica el tema según la preferencia del sistema operativo/navegador (claro → Industry, oscuro → Nocturne).
2. **Given** el usuario está en cualquier pantalla, **When** cambia el tema manualmente, **Then** el cambio se aplica de inmediato a toda la app y persiste entre sesiones.
3. **Given** el tema activo es Industry, **When** el usuario ve la pantalla de Captura, **Then** las tarjetas son dibujos de línea sin relleno con esquinas cuadradas y marcas de registro en las 4 esquinas, el botón primario es el único elemento con relleno sólido, y los 6 estados de foto muestran su color e ícono correspondiente (gris/acento/verde/ámbar/rojo/violeta).
4. **Given** el tema activo es Nocturne, **When** el usuario ve la misma pantalla, **Then** las tarjetas tienen relleno de superficie con radios de 8px, los separadores son degradados (no líneas duras), y el botón primario es un contorno acento sobre fondo transparente.
5. **Given** el usuario está en Detalle de una factura, **When** revisa los campos extraídos, **Then** cada campo muestra su punto de confianza (verde/ámbar/rojo) según el tema activo, el banner de elegibilidad muestra el motivo específico ya calculado por el dominio, y un campo corregido manualmente muestra el badge "Corregido" + el valor original tachado.
6. **Given** el usuario está en el Listado, **When** aplica filtros, **Then** el bloque de total agregado recalcula en vivo y las filas de facturas en moneda distinta a COP muestran su badge de moneda y quedan explícitamente marcadas como excluidas del total (sin romper el cálculo ya existente en el backend).

---

### User Story 2 - Eliminar factura (soft-delete) (Priority: P2)

Como usuario, quiero poder eliminar una factura que subí por error o duplicada manualmente, sin perder el archivo original ni el registro de forma irrecuperable, para mantener mi listado limpio sin arriesgarme a perder evidencia.

**Why this priority**: Es una capacidad nueva real (no solo visual) que ya estaba aprobada como requisito (FR-029) desde la feature 001 pero nunca se construyó; el diseño la vuelve visible por primera vez a través del menú "···" de Detalle.

**Independent Test**: Desde el menú "···" en Detalle, elegir "Eliminar factura", confirmar, y verificar que la factura desaparece del listado normal pero el registro y la imagen original siguen existiendo en la base de datos/almacenamiento, sin ningún proceso automático que los purgue.

**Acceptance Scenarios**:

1. **Given** una factura en cualquier estado, **When** el usuario elige "Eliminar factura" desde el menú "···" y confirma, **Then** la factura deja de aparecer en el listado y en los totales agregados, pero el registro y el archivo de imagen original permanecen intactos y recuperables en el sistema.
2. **Given** una factura ya eliminada (soft-delete), **When** pasa cualquier cantidad de tiempo, **Then** ningún proceso automático la purga ni la borra de forma definitiva — solo una acción manual explícita (fuera de alcance de esta historia) podría hacerlo en el futuro.
3. **Given** el usuario abre el menú "···" de Detalle, **When** aún no ha confirmado la eliminación, **Then** el sistema pide una confirmación explícita antes de ejecutar el soft-delete (para evitar eliminaciones accidentales).

---

### User Story 3 - Detección de varias facturas en una foto (Priority: P3)

Como usuario, quiero que el sistema me avise cuando una foto que subí contiene más de una factura física, en vez de intentar leerla como un solo documento y confundir los datos, para poder recapturar cada factura por separado.

**Why this priority**: También es un requisito ya aprobado (FR-028) desde la feature 001 nunca construido; depende de una señal nueva del modelo de extracción (best-effort, no garantizado al 100%), por lo que es más incierta que la eliminación y se prioriza después.

**Independent Test**: Subir una foto que contenga visiblemente dos facturas distintas y confirmar que la foto queda marcada con el sexto estado ("varias facturas detectadas") en vez de extraer datos mezclados de ambas, con una acción explícita para recapturar por separado.

**Acceptance Scenarios**:

1. **Given** una foto que contiene más de un documento de compra distinto, **When** el sistema la procesa, **Then** el registro de `Factura` ya creado al subir la foto transiciona al estado "varias facturas en una foto" (color e ícono propios) en vez de "extraída" o "necesita revisión", sin poblar ningún campo extraído con datos mezclados de ambos documentos.
2. **Given** una foto marcada como "varias facturas", **When** el usuario elige "Separar y recapturar", **Then** el sistema lo guía a volver a fotografiar cada factura por separado (sin conservar ni reutilizar los datos de la foto original).
3. **Given** una foto que en realidad contiene un solo documento, **When** el sistema la procesa, **Then** no se marca falsamente como "varias facturas" en el caso normal esperado (aceptando que la detección es best-effort y puede fallar en casos límite, según spec de la feature 001).

---

### User Story 4 - Pantalla de estado vacío (Priority: P4)

Como usuario que aún no ha subido ninguna factura, quiero ver una pantalla de bienvenida clara que me invite a capturar mi primera factura, en vez de un listado vacío sin contexto, para entender de inmediato qué hacer.

**Why this priority**: Aporta valor pero es de bajo riesgo y bajo esfuerzo — una pantalla estática sin lógica de negocio nueva, que no bloquea ninguna otra historia.

**Independent Test**: Con una cuenta sin ninguna factura registrada, abrir el Listado y confirmar que se muestra la pantalla de estado vacío (no una tabla vacía), con su botón primario llevando directo a Captura.

**Acceptance Scenarios**:

1. **Given** el usuario no tiene ninguna factura registrada, **When** abre el Listado, **Then** ve la pantalla de estado vacío con el copy y botón primario definidos en el diseño, en vez de una tabla o lista sin contenido.
2. **Given** el usuario está en la pantalla de estado vacío, **When** toca el botón primario, **Then** es llevado directamente a la pantalla de Captura.

---

### User Story 5 - Refinamiento visual de confirmación de duplicado (Priority: P5)

Como usuario, quiero que el bottom sheet de confirmación de posible duplicado (ya funcional) se vea consistente con el nuevo sistema de diseño, para que no se sienta como una pantalla distinta al resto de la app.

**Why this priority**: Es puramente cosmético — la funcionalidad de detección y resolución de duplicados ya existe y funciona; esta historia solo aplica los tokens visuales del tema activo.

**Independent Test**: Provocar un duplicado probable (dos facturas con mismo comercio/fecha/total sin CUFE confiable) y confirmar que el bottom sheet resultante usa los colores, tipografía y tratamiento de tarjetas del tema activo, sin cambios en su comportamiento de resolución.

**Acceptance Scenarios**:

1. **Given** una marca de posible duplicado pendiente, **When** el usuario ve el bottom sheet, **Then** su apariencia (colores, tipografía, tarjetas comparativas) coincide con el tema activo (Industry o Nocturne).
2. **Given** el bottom sheet visualmente actualizado, **When** el usuario confirma o descarta el duplicado, **Then** el comportamiento de resolución (ya implementado) no cambia.

---

### Edge Cases

- ¿Qué pasa si el usuario cambia de tema mientras tiene una edición de campo sin guardar en Detalle? El cambio de tema no debe descartar cambios en curso.
- ¿Qué pasa si el modelo de extracción no logra determinar con certeza si una foto tiene una o varias facturas? Se trata como caso normal (una factura) — la detección de "varias" solo se activa con señal explícita y suficientemente segura del modelo, nunca por duda.
- ¿Qué pasa si el usuario elimina (soft-delete) la única factura que sustenta una marca de posible duplicado pendiente? La marca pendiente debe poder resolverse o descartarse sin error aunque una de las dos facturas ya esté eliminada.
- ¿Qué pasa con una factura eliminada (soft-delete) que estaba marcada como no elegible o en revisión? Su estado y motivo se conservan tal cual estaban al momento de eliminarla — el soft-delete no recalcula ni modifica ningún campo, solo la oculta del listado.
- ¿Qué pasa si el usuario intenta eliminar una factura que ya fue eliminada (doble clic, dos pestañas)? La segunda solicitud no debe producir un error visible ni un estado inconsistente.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST ofrecer dos temas visuales completos e intercambiables ("Industry" claro y "Nocturne" oscuro), aplicados de forma consistente a las 5 pantallas de la app.
- **FR-002**: El sistema MUST permitir seleccionar el tema manualmente y MUST respetar la preferencia de tema del sistema operativo/navegador cuando el usuario no ha elegido uno explícitamente.
- **FR-003**: La preferencia de tema elegida manualmente MUST persistir entre sesiones del mismo usuario.
- **FR-004**: El sistema MUST mostrar 6 estados visuales distintos para cada foto en la pantalla de Captura (recibida, procesando, extraída, necesita revisión, fallida, varias facturas), cada uno con su propio color e ícono, consistentes con el tema activo.
- **FR-005**: El sistema MUST mostrar el nivel de confianza de cada campo extraído en Detalle mediante un indicador visual de color (alta/media/baja), y MUST distinguir visualmente un campo corregido manualmente de su valor extraído original (mostrando ambos).
- **FR-006**: El sistema MUST mostrar el banner de elegibilidad tributaria (elegible o no elegible con motivo específico) usando el tratamiento visual y colores definidos por el tema activo, reflejando el cálculo ya existente en el dominio sin alterarlo.
- **FR-007**: El sistema MUST indicar visualmente, en el listado, cuando una factura está en una moneda distinta a COP (badge con el código de moneda) y MUST dejar explícito que dicha factura no participa en el total agregado, sin alterar el cálculo ya existente en el backend.
- **FR-008**: El sistema MUST ofrecer una acción "Eliminar factura" (soft-delete) desde el detalle de cada factura, accesible mediante confirmación explícita del usuario.
- **FR-009**: Una factura eliminada (soft-delete) MUST dejar de aparecer en el listado normal, en los totales agregados, y en cualquier consulta directa por identificador (comportamiento equivalente a "no encontrado" ante un enlace o solicitud directa); su registro y su imagen original MUST permanecer recuperables en el almacenamiento/base de datos y MUST NOT ser purgados por ningún proceso automático (alineado con el principio de inmutabilidad de la evidencia del proyecto).
- **FR-010**: El sistema MUST detectar, de forma best-effort, cuando una foto contiene más de un documento de compra distinto, y en ese caso MUST transicionar el registro de `Factura` ya existente para esa foto a un nuevo valor de estado ("varias facturas"), sin poblar ningún campo extraído con datos mezclados de ambos documentos.
- **FR-011**: Una foto marcada como "varias facturas" MUST ofrecer al usuario una acción explícita para recapturar cada factura por separado, y MUST NOT reutilizar ni conservar los datos de esa foto original en ningún registro de factura.
- **FR-012**: El sistema MUST mostrar una pantalla de estado vacío (con acción directa a Captura) cuando el usuario no tiene ninguna factura registrada, en vez de un listado o tabla sin contenido.
- **FR-013**: El sistema MUST aplicar el sistema de diseño vigente a la pantalla de confirmación de posible duplicado (bottom sheet), sin alterar su lógica de resolución ya existente.

### Key Entities

- **Preferencia de tema**: la elección del usuario entre Industry, Nocturne, o "según el sistema" — persistida por usuario/sesión, sin impacto en ningún otro dato del sistema.
- **Factura (extendida)**: se añade la posibilidad de un estado de eliminación (soft-delete) que oculta el registro de las vistas normales sin destruirlo, y un nuevo valor dentro de la máquina de estados ya existente para "varias facturas detectadas en la foto" (reutiliza el mismo registro creado al subir la foto, no una entidad nueva).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las pantallas existentes (Captura, Detalle, Listado, confirmación de duplicado) y la nueva pantalla de estado vacío reflejan fielmente los tokens de color, tipografía y tratamiento de tarjetas de ambos temas de referencia, verificado por inspección visual directa contra el diseño validado.
- **SC-002**: El usuario puede cambiar entre tema claro y oscuro en menos de 2 toques desde cualquier pantalla, y el cambio se refleja de inmediato sin recargar datos.
- **SC-003**: El usuario puede eliminar una factura y confirmar, sin ayuda externa, que el archivo original de la imagen sigue existiendo en el sistema tras la eliminación.
- **SC-004**: Ninguna funcionalidad existente (clasificación tributaria, cálculo de elegibilidad, detección de duplicados, filtros y totales del listado) cambia de comportamiento como resultado de esta feature — verificado repitiendo los escenarios de aceptación de la feature 001 tras el rediseño.

## Assumptions

- El rediseño se implementa como una actualización de la aplicación web existente, no como una aplicación nativa (iOS/Android) — se descarta explícitamente por costo y porque el usuario ya accede desde el navegador del celular.
- El diseño de referencia (handoff con README + HTML) es la fuente de verdad de composición visual y contenido; donde el HTML y el README difieran, manda el README actualizado.
- La detección de "varias facturas en una foto" (US3) depende de la capacidad del modelo de extracción con visión ya integrado — es un ajuste de instrucción/prompt sobre el mecanismo existente, no un modelo o proveedor nuevo, y se acepta que sea best-effort (no garantizado al 100%), tal como ya lo documenta la feature 001.
- El soft-delete (US2) no incluye, en esta feature, una pantalla de "papelera" para ver y restaurar facturas eliminadas — esa pantalla queda fuera de alcance y puede abordarse en una fase futura si se necesita; lo mínimo indispensable es que "eliminar" oculte la factura sin destruir el registro.
- Los cambios de clasificación tributaria, elegibilidad y detección de duplicados ya implementados en la feature 001 no se modifican — esta feature es exclusivamente de presentación visual más los dos requisitos ya aprobados (FR-028, FR-029) que nunca se construyeron.
