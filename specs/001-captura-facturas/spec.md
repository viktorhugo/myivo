# Feature Specification: Captura y Registro Estructurado de Facturas

**Feature Branch**: `001-captura-facturas`

**Created**: 2026-07-25

**Status**: Draft

**Input**: User description: "Quiero el primer módulo de mi sistema personal de facturas: capturar facturas físicas con la cámara del celular (o subir fotos existentes) y convertirlas en registros estructurados y consultables, identificando cuáles son facturas electrónicas válidas ante la DIAN y cuáles son simples tiquetes POS.

## Quién lo usa y por qué
Soy el único usuario. Acumulo facturas físicas de establecimientos comerciales y hoy las fotografío sin ningún orden. Quiero:
1. Dejar de perder facturas y tener un registro detallado de cada compra (comercio, fecha, ítems, valores, impuestos, medio de pago).
2. Saber cuáles compras están soportadas con factura electrónica a mi nombre, porque solo esas sirven para la deducción del 1% en mi declaración de renta.
3. Poder buscar y filtrar mis compras después (por comercio, fecha, monto, elegibilidad tributaria).

## Historias de usuario

### H1 — Capturar una factura
Como usuario, quiero tomar una foto a una factura desde mi celular (o subir una imagen ya tomada) y que el sistema la guarde inmediatamente, para no depender de que el procesamiento posterior funcione.
- La foto queda guardada aunque la extracción falle.
- Puedo subir varias fotos en lote (mi backlog actual de facturas acumuladas).
- Veo el estado de cada factura: recibida, procesando, extraída, necesita revisión, fallida.

### H2 — Extracción automática de datos
Como usuario, quiero que el sistema extraiga automáticamente los datos de la factura fotografiada, para no digitarlos a mano.
Datos mínimos: nombre y NIT del comercio, fecha y hora de compra, ítems con descripción/cantidad/valor unitario/valor total, subtotal, IVA (por tarifa), impuesto al consumo si aplica, propina, total, medio de pago si es visible, y datos del adquiriente (nombre/identificación) si aparecen.
- Si la imagen contiene un código QR de factura electrónica, el sistema obtiene de ahí el identificador único del documento (CUFE/CUDE).
- Cada campo extraído tiene un nivel de confianza; los registros con baja confianza o totales que no cuadran quedan marcados para mi revisión.
- Puedo corregir manualmente cualquier campo extraído, y la corrección queda diferenciada del valor extraído originalmente.

### H3 — Clasificación tributaria
Como usuario, quiero que cada documento quede clasificado por tipo (factura electrónica de venta, documento equivalente POS, otro) y con una marca de elegibilidad tributaria, para saber de inmediato si me sirve para la deducción del 1% en renta.
- La elegibilidad considera: tipo de documento, si está emitido a mi identificación, y si el medio de pago registrado es electrónico.
- Cuando un documento NO es elegible, el sistema me dice por qué (ej: "es tiquete POS", "no está a tu nombre", "pago en efectivo").

### H4 — Detección de duplicados
Como usuario, quiero que el sistema detecte cuando subo dos fotos de la misma factura, para no inflar mis registros.
- Duplicado exacto por identificador único del documento (CUFE) cuando existe.
- Duplicado probable por combinación comercio + fecha + total cuando no hay CUFE; en ese caso el sistema pregunta en vez de decidir solo.

### H5 — Consulta básica
Como usuario, quiero listar y filtrar mis facturas (por rango de fechas, comercio, monto, tipo de documento, elegibilidad, estado) y ver el detalle de cada una junto a su foto original.

## Casos borde que el sistema debe manejar
- Foto borrosa o incompleta: la extracción reporta qué campos no pudo leer, no inventa valores.
- QR presente pero ilegible: se intenta fallback y el documento queda marcado con esa condición.
- Tiquete POS sin QR ni CUFE: es un flujo normal, no un error.
- Factura en moneda distinta a COP: se registra la moneda tal cual, sin conversión automática.
- Varias facturas en una misma foto: fuera de alcance en esta versión; el sistema lo detecta si puede y pide fotos separadas.

## Fuera de alcance (fases futuras)
- Validación/conciliación contra la DIAN (feature 002).
- Reportes anuales para declaración de renta (feature 003).
- Multi-usuario, roles, o compartir con el contador.
- Extracción desde PDF de facturas electrónicas recibidas por correo (deseable después).

## Criterio de éxito del MVP
Puedo procesar mi backlog acumulado de facturas físicas en una sesión, terminar con más del 80% de registros extraídos sin corrección manual, y responder la pregunta: "¿cuánto llevo este año en compras elegibles para la deducción del 1%?""

## Clarifications

### Session 2026-07-25

- Q: ¿Qué valores de medio de pago cuentan como "electrónico" para efectos de elegibilidad tributaria (FR-015/FR-018)? → A: Enum cerrado (efectivo, tarjeta débito, tarjeta crédito, transferencia/PSE, billetera digital); todo excepto "efectivo" cuenta como electrónico.
- Q: ¿Cómo se accede al sistema desde el celular fuera de casa para capturar facturas, dado que los datos son sensibles (constitution Principio VII)? → A: App expuesta en internet (dominio propio + HTTPS) protegida con autenticación simple de un solo usuario.
- Q: ¿Qué tan exacta debe ser la coincidencia de comercio + fecha + total para marcar un "duplicado probable" (FR-020)? → A: Coincidencia flexible — nombre de comercio similar (tolerante a variaciones de OCR), fecha calendario exacta, total exacto.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Capturar una factura sin depender del procesamiento (Priority: P1)

Como usuario, quiero tomar una foto a una factura desde mi celular (o subir una imagen ya tomada) y que el sistema la guarde inmediatamente, para no depender de que el procesamiento posterior funcione.

**Why this priority**: Es la base de todo el sistema — sin esto no existe ningún dato que procesar. Por sí sola ya resuelve el primer problema declarado ("dejar de perder facturas"), incluso si nada más estuviera implementado.

**Independent Test**: Se puede probar tomando o subiendo una o varias fotos y verificando que cada una queda guardada y visible con un estado propio, sin que exista todavía extracción, clasificación ni consulta avanzada.

**Acceptance Scenarios**:

1. **Given** que el usuario tiene una factura física en mano, **When** toma una foto con la cámara del celular, **Then** la foto queda guardada de inmediato y visible en el sistema con estado "recibida".
2. **Given** que el usuario tiene fotos de facturas ya tomadas previamente, **When** las selecciona y sube en lote, **Then** cada foto se guarda como un registro independiente, cada uno con su propio estado.
3. **Given** que el procesamiento posterior de una factura falla por completo, **When** el usuario consulta esa factura, **Then** la foto original sigue disponible y el estado refleja el fallo, sin pérdida del archivo.
4. **Given** un conjunto de facturas recién subidas, **When** el usuario revisa la lista, **Then** puede ver para cada una cuál de los estados (recibida, procesando, extraída, necesita revisión, fallida) tiene actualmente.

---

### User Story 2 - Extracción automática de datos (Priority: P2)

Como usuario, quiero que el sistema extraiga automáticamente los datos de la factura fotografiada, para no digitarlos a mano.

**Why this priority**: Convierte las fotos ya guardadas en información utilizable; es lo que le da valor de "registro detallado" al backlog capturado en la Historia 1.

**Independent Test**: Con una factura ya almacenada, se puede verificar que el sistema propone valores estructurados para comercio, fecha, ítems y totales, cada uno con su nivel de confianza, sin depender de que exista clasificación tributaria ni consulta.

**Acceptance Scenarios**:

1. **Given** una foto de factura almacenada, **When** el sistema la procesa, **Then** extrae comercio, NIT, fecha/hora, ítems (descripción/cantidad/valor unitario/valor total), subtotal, IVA por tarifa, impuesto al consumo si aplica, propina, total, medio de pago y datos del adquiriente cuando están visibles.
2. **Given** una foto que contiene un código QR de factura electrónica legible, **When** el sistema la procesa, **Then** obtiene el CUFE/CUDE decodificando ese código, no leyendo texto impreso.
3. **Given** que los totales extraídos no cuadran entre sí (subtotal + impuestos + propina ≠ total), **When** se completa la extracción, **Then** la factura queda marcada como "necesita revisión" en lugar de corregirse automáticamente.
4. **Given** un campo extraído con baja confianza, **When** el usuario revisa la factura, **Then** puede identificar cuáles campos tienen baja confianza y corregirlos manualmente.
5. **Given** que el usuario corrige un valor extraído, **When** guarda el cambio, **Then** el sistema conserva tanto el valor originalmente extraído como el valor corregido, diferenciados entre sí.

---

### User Story 3 - Clasificación tributaria y elegibilidad (Priority: P3)

Como usuario, quiero que cada documento quede clasificado por tipo y con una marca de elegibilidad tributaria, para saber de inmediato si me sirve para la deducción del 1% en renta.

**Why this priority**: Es la razón de ser del sistema para efectos de renta — sin esto, tener los datos extraídos no le dice al usuario cuáles compras realmente sirven para la deducción.

**Independent Test**: Con una factura ya extraída, se puede verificar que queda clasificada en un tipo de documento y que muestra una marca de elegibilidad con motivo, de forma verificable sin necesitar las historias de consulta o duplicados.

**Acceptance Scenarios**:

1. **Given** una factura extraída con CUFE válido, emitida a la identificación del usuario y pagada por medio electrónico, **When** se evalúa, **Then** queda clasificada como elegible para la deducción del 1%.
2. **Given** un tiquete POS sin CUFE, **When** se evalúa, **Then** queda clasificado como no elegible con el motivo "es tiquete POS".
3. **Given** una factura electrónica válida pero emitida a un nombre/identificación distinto al del usuario, **When** se evalúa, **Then** queda no elegible con el motivo "no está a tu nombre".
4. **Given** una factura electrónica válida pagada en efectivo, **When** se evalúa, **Then** queda no elegible con el motivo "pago en efectivo".
5. **Given** que el usuario corrige manualmente un campo que afecta la elegibilidad (p. ej. el medio de pago), **When** guarda el cambio, **Then** la elegibilidad se recalcula automáticamente a partir de las reglas, sin que el usuario pueda fijarla a mano de forma directa.

---

### User Story 4 - Consulta y filtrado de facturas (Priority: P4)

Como usuario, quiero listar y filtrar mis facturas y ver el detalle de cada una junto a su foto original.

**Why this priority**: Es lo que permite usar el registro acumulado para responder preguntas concretas, incluida la del monto anual elegible; depende de que ya existan datos capturados, extraídos y clasificados por las historias anteriores.

**Independent Test**: Con un conjunto de facturas ya cargadas en distintos estados, se puede verificar que el usuario puede listar, filtrar por cada criterio soportado y abrir el detalle de una factura junto a su foto original, de forma aislada del resto de funcionalidades.

**Acceptance Scenarios**:

1. **Given** un conjunto de facturas cargadas, **When** el usuario filtra por rango de fechas, comercio, monto, tipo de documento, elegibilidad o estado, **Then** la lista se actualiza mostrando solo las facturas que cumplen todos los criterios activos.
2. **Given** una lista filtrada de facturas, **When** el usuario la consulta, **Then** ve el conteo y la suma total de los valores de las facturas dentro del filtro aplicado.
3. **Given** una factura en la lista, **When** el usuario abre su detalle, **Then** ve todos los campos extraídos/corregidos junto a la foto original correspondiente.
4. **Given** que el usuario quiere saber cuánto lleva acumulado en el año en compras elegibles, **When** filtra por año y por elegibilidad, **Then** obtiene esa cifra directamente sin sumar manualmente factura por factura.

---

### User Story 5 - Detección de duplicados (Priority: P5)

Como usuario, quiero que el sistema detecte cuando subo dos fotos de la misma factura, para no inflar mis registros.

**Why this priority**: Protege la integridad del registro acumulado, pero solo tiene sentido una vez que ya existe un flujo de captura y datos con los que comparar; el resto del sistema sigue siendo útil sin esto, aunque con menor confiabilidad en los totales agregados.

**Independent Test**: Subiendo dos fotos que representan la misma compra, se puede verificar de forma aislada que el sistema detecta la coincidencia y actúa según haya o no CUFE, sin depender de las historias de clasificación o consulta.

**Acceptance Scenarios**:

1. **Given** dos facturas con el mismo CUFE, **When** la segunda se ingresa, **Then** el sistema la marca como duplicado exacto de forma automática.
2. **Given** dos facturas sin CUFE que comparten comercio, fecha y total, **When** la segunda se ingresa, **Then** el sistema la marca como "posible duplicado" y le pregunta al usuario si es la misma compra u otra distinta, en lugar de decidir automáticamente.
3. **Given** una factura marcada como posible duplicado, **When** el usuario confirma que son compras distintas, **Then** ambas quedan como registros independientes y no se vuelve a preguntar por esa combinación.
4. **Given** que se está subiendo un lote de fotos, **When** alguna resulta duplicada, **Then** el resto del lote se sigue procesando con normalidad, sin bloquearse.

---

### Edge Cases

- Foto borrosa o con parte de la factura fuera de encuadre: el sistema reporta cuáles campos no pudo leer; no inventa ni aproxima valores para esos campos.
- Código QR presente pero ilegible: el sistema intenta el mecanismo de respaldo (lectura del CUFE impreso) y marca la factura con una condición de confianza reducida por haber usado el respaldo.
- Tiquete POS sin QR ni CUFE: se procesa como flujo normal, no como error; su tipo de documento y elegibilidad reflejan esa condición.
- Factura en una moneda distinta a COP: se registra la moneda indicada tal cual, sin conversión automática; queda visible en los listados pero fuera del total agregado de "elegible en COP".
- Varias facturas físicas capturadas en una misma foto: el sistema la marca y solicita al usuario volver a capturarla como fotos separadas, una por factura, en lugar de procesarla como un solo documento.
- Factura duplicada subida como parte de un lote: no bloquea el resto del lote (ver Historia 5).
- Fallo total del procesamiento de extracción: la foto permanece guardada y la factura queda en estado "fallida", disponible para un futuro reintento.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir capturar una foto de una factura física usando la cámara del dispositivo móvil, o subir un archivo de imagen ya existente, como formas equivalentes de ingresar un documento.
- **FR-002**: El sistema MUST permitir subir varias imágenes en una sola operación por lote.
- **FR-003**: El sistema MUST guardar cada imagen capturada o subida de inmediato, antes de que corra cualquier procesamiento automático, e independientemente de si ese procesamiento luego tiene éxito o falla.
- **FR-004**: El sistema MUST asignar a cada documento ingresado un estado visible dentro del conjunto {recibida, procesando, extraída, necesita revisión, fallida}, y MUST actualizarlo a medida que el documento avanza en el procesamiento.
- **FR-005**: El sistema MUST NOT eliminar ni sobrescribir el archivo de imagen original como parte de ningún procesamiento automático.
- **FR-006**: El sistema MUST extraer, cuando estén presentes y legibles en la imagen, los siguientes campos: nombre del comercio, NIT del comercio, fecha y hora de compra, ítems (descripción, cantidad, valor unitario, valor total), subtotal, IVA desglosado por tarifa, impuesto al consumo si aplica, propina, total, medio de pago, y nombre/identificación del adquiriente.
- **FR-007**: Cuando la imagen contenga un código QR de factura electrónica escaneable, el sistema MUST obtener el identificador único del documento (CUFE/CUDE) decodificando ese código, en lugar de leerlo como texto impreso.
- **FR-008**: Cuando el código QR esté presente pero no sea decodificable, el sistema MUST recurrir a leer el CUFE/CUDE impreso como respaldo, y MUST registrar que ese valor proviene del mecanismo de respaldo con confianza reducida.
- **FR-009**: El sistema MUST registrar un nivel de confianza para cada campo extraído.
- **FR-010**: El sistema MUST verificar que subtotal, impuestos, propina y demás componentes cuadren contra el total extraído; cuando no cuadren, MUST marcar el documento como "necesita revisión" en lugar de ajustar cualquier valor de forma silenciosa.
- **FR-011**: El sistema MUST permitir al usuario editar manualmente cualquier campo extraído.
- **FR-012**: Cuando un campo se corrige manualmente, el sistema MUST conservar tanto el valor originalmente extraído como el valor corregido, diferenciados entre sí.
- **FR-013**: Cuando la extracción automática falla por completo para un documento, el sistema MUST mantener accesible la imagen guardada, MUST marcar el documento con estado "fallida", y MUST dejarlo disponible para un futuro reintento de procesamiento.
- **FR-014**: El sistema MUST clasificar cada documento en uno de los tipos definidos: factura electrónica de venta, documento equivalente POS, documento soporte, otro, o desconocido.
- **FR-015**: El sistema MUST calcular una marca de elegibilidad para la deducción tributaria de cada documento, con base en su tipo de documento, si está emitido a la identificación del usuario, y si el medio de pago registrado es electrónico. El medio de pago MUST clasificarse en uno de estos valores: efectivo, tarjeta débito, tarjeta crédito, transferencia/PSE, o billetera digital; todos excepto "efectivo" cuentan como medio de pago electrónico para esta evaluación.
- **FR-016**: La marca de elegibilidad MUST ser siempre un valor calculado; el sistema MUST NOT permitir que el usuario la fije directamente a mano.
- **FR-017**: Corregir cualquier campo que alimente el cálculo de elegibilidad MUST recalcular automáticamente la marca de elegibilidad.
- **FR-018**: Cuando un documento no es elegible, el sistema MUST mostrar al usuario el motivo específico (p. ej. "es tiquete POS", "no está a tu nombre", "pago en efectivo").
- **FR-019**: El sistema MUST detectar duplicados exactos: dos documentos que comparten el mismo CUFE/CUDE MUST quedar marcados como duplicados de forma automática, sin preguntar al usuario.
- **FR-020**: El sistema MUST detectar duplicados probables: dos documentos sin CUFE cuya fecha y total coinciden exactamente, y cuyo nombre de comercio es similar (tolerante a variaciones menores producto de la extracción, no exige coincidencia carácter por carácter), MUST quedar marcados como posible duplicado, y el sistema MUST pedir al usuario que confirme si representan la misma compra, en lugar de decidirlo automáticamente.
- **FR-021**: Un documento marcado como posible duplicado MUST NOT bloquear el ingreso del resto de un lote en carga.
- **FR-022**: El sistema MUST permitir listar y filtrar documentos por rango de fechas, comercio, monto, tipo de documento, elegibilidad y estado, en cualquier combinación.
- **FR-023**: Para una lista filtrada de documentos, el sistema MUST mostrar el conteo y la suma monetaria total de los documentos que cumplen el filtro.
- **FR-024**: El sistema MUST permitir abrir el detalle de cualquier documento, mostrando todos los campos extraídos y corregidos junto a la imagen original capturada.
- **FR-025**: Cuando la extracción no pueda leer un campo determinado (p. ej. por una foto borrosa o incompleta), el sistema MUST reportarlo como no leído en lugar de inferir o inventar un valor para él.
- **FR-026**: El sistema MUST registrar la moneda de cada documento tal como fue extraída, sin realizar conversión automática de moneda.
- **FR-027**: El total agregado de "elegible" (FR-023 aplicado con el filtro de elegibilidad) MUST incluir únicamente documentos registrados en la moneda por defecto (COP); los documentos en otras monedas MUST permanecer visibles en los listados pero excluidos de ese agregado.
- **FR-028**: Cuando una sola foto parezca contener más de una factura física, el sistema MUST marcar la imagen y solicitar al usuario volver a capturarla como fotos separadas, una por documento, en lugar de intentar procesarla como un solo documento.
- **FR-029**: Eliminar un documento desde las vistas del usuario MUST ser un soft-delete: el registro y los archivos subyacentes MUST permanecer recuperables y MUST NOT ser purgados por ningún proceso automático.
- **FR-030**: El sistema MUST exigir autenticación de un único usuario (usuario/contraseña o passkey) sobre una conexión HTTPS antes de permitir el acceso a cualquier factura, imagen o dato del sistema, dado que la aplicación es accesible desde internet para permitir la captura fuera de casa.

### Key Entities *(include if feature involves data)*

- **Factura (Documento de Compra)**: Representa una compra respaldada por una imagen capturada. Incluye estado del pipeline, tipo de documento, marca y motivo de elegibilidad tributaria, moneda, montos (subtotal, impuestos, propina, total), medio de pago, fecha/hora de compra, identificador único (CUFE/CUDE) cuando aplica, y su nivel de confianza global.
- **Ítem de Factura**: Cada línea de producto o servicio dentro de una factura, con descripción, cantidad, valor unitario y valor total, y su propio nivel de confianza.
- **Comercio**: El establecimiento emisor referenciado por una factura (nombre y NIT). En esta funcionalidad vive como parte de cada factura, sin un directorio de comercios independiente.
- **Corrección Manual**: Registro de un campo editado por el usuario, que conserva el valor originalmente extraído y el valor corregido de forma diferenciada.
- **Marca de Posible Duplicado**: Relación entre dos facturas que el sistema considera la misma compra, pendiente o resuelta mediante confirmación explícita del usuario.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El usuario puede capturar o subir al menos 50 fotos de facturas en una sola sesión sin que un fallo de procesamiento en una de ellas impida continuar con las demás.
- **SC-002**: Al menos el 80% de las facturas ingresadas quedan con sus campos mínimos extraídos sin requerir ninguna corrección manual.
- **SC-003**: El usuario puede obtener el total acumulado de compras elegibles para la deducción del 1% en un año determinado en un solo paso de filtrado, sin sumar manualmente factura por factura.
- **SC-004**: Ninguna factura con el mismo CUFE queda registrada dos veces como compra independiente.
- **SC-005**: El usuario puede localizar una factura específica ya cargada (conociendo comercio, fecha aproximada o monto) filtrando la lista, sin necesitar recorrer manualmente todo el historial.

## Assumptions

- Es un sistema personal de un único usuario; no se requieren mecanismos de autenticación multi-usuario ni control de roles en esta funcionalidad.
- El usuario configura, una única vez, su(s) propio(s) número(s) de identificación (cédula y/o NIT); esa identidad es la que se compara contra el adquiriente extraído de cada factura para evaluar elegibilidad.
- La taxonomía de tipos de documento adoptada es la ya ratificada en la constitución del proyecto (`factura_electronica`, `documento_equivalente_pos`, `documento_soporte`, `otro`, `desconocido`), que amplía los tres tipos mencionados explícitamente en la descripción original de la funcionalidad.
- No hay un límite duro de tamaño de lote definido por el usuario; se asume un mínimo soportado de 50 imágenes por sesión como referencia para cubrir el backlog acumulado mencionado.
- Los formatos de imagen aceptados son los estándar de cámaras de celular (JPEG, PNG, HEIC); no se exige un formato específico.
- Detectar que una foto contiene varias facturas es un esfuerzo de mejor intención (best-effort); no se garantiza detectarlo en el 100% de los casos.
- Quedan fuera de alcance de esta funcionalidad: la validación/conciliación contra la DIAN, los reportes anuales para la declaración de renta, el soporte multi-usuario o para compartir con un contador, y la extracción desde PDF de facturas electrónicas recibidas por correo — se atienden en funcionalidades futuras.
