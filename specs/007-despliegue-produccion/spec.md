# Feature Specification: Despliegue en Producción

**Feature Branch**: `007-despliegue-produccion`

**Created**: 2026-08-06

**Status**: Draft

**Input**: User description: "Quiero poder desplegar myivo en un VPS y usarlo a diario con la confianza de que mis facturas —que son evidencia tributaria— no se pierden ni quedan expuestas. Hoy el sistema funciona en desarrollo, pero no existe una forma reproducible de ponerlo en línea ni de recuperarlo si algo falla. [...] Soy el único usuario. Voy a usar el sistema desde mi celular, en la calle, apenas me entreguen una factura. Necesito que esté disponible, que mi sesión no se caiga, que procesar el backlog acumulado no lo tumbe, y que si el servidor se muere pueda recuperar todo." (8 historias de usuario US1-US8 con criterios de aceptación explícitos, hallazgos técnicos previos para /speckit-plan, y restricciones ligadas a la constitution — ver transcripción completa del comando).

## Clarifications

### Session 2026-08-06

- Q: ¿Cuál debe ser el destino externo del respaldo cifrado? → A: Un proveedor de almacenamiento de objetos de terceros, barato (ej. Backblaze B2 o similar) — el usuario crea la cuenta y provee las credenciales.
- Q: ¿Dónde vive la llave de cifrado del respaldo? → A: Variable de entorno en el `.env` del servidor, con copia manual del usuario en un gestor de contraseñas personal, fuera del sistema — nunca solo en el servidor que se está respaldando.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Levantar el sistema completo con un comando (Priority: P1)

Como usuario, quiero levantar todo el sistema (base de datos, API, interfaz web, capa de acceso público con HTTPS) en un servidor nuevo con un solo comando y un archivo de configuración, para poder desplegar y redesplegar sin pasos manuales que se olviden.

**Why this priority**: Sin esto no existe "producción" — es el requisito habilitante de todas las demás historias. Un despliegue que depende de pasos manuales recordados de memoria es, en la práctica, un despliegue que eventualmente se hace mal.

**Independent Test**: Se prueba por completo aprovisionando un VPS limpio, siguiendo el procedimiento documentado (quickstart), y verificando que el sistema completo responde por HTTPS en el dominio propio, con la base de datos inaccesible desde fuera y sin ningún paso manual adicional no documentado.

**Acceptance Scenarios**:

1. **Given** un servidor recién aprovisionado sin nada instalado, **When** se sigue el procedimiento de despliegue documentado, **Then** el sistema queda accesible por HTTPS en un dominio propio en menos de 15 minutos.
2. **Given** una versión nueva del sistema con cambios de esquema de base de datos, **When** se despliega esa versión, **Then** los cambios de esquema se aplican automáticamente, sin que el usuario ejecute ninguna migración a mano.
3. **Given** el sistema ya desplegado con facturas capturadas, **When** los contenedores se recrean (redespliegue, reinicio del servidor), **Then** las imágenes originales y sus derivados siguen existiendo exactamente igual.
4. **Given** el sistema desplegado, **When** se intenta acceder a la base de datos desde fuera del servidor, **Then** la conexión es rechazada — la base de datos nunca está expuesta a internet.
5. **Given** una configuración obligatoria faltante o inválida (por ejemplo, un secreto vacío), **When** el sistema intenta arrancar, **Then** falla de inmediato con un mensaje claro indicando qué falta, en vez de arrancar en un estado parcialmente funcional.

---

### User Story 2 - Mi sesión sobrevive al despliegue y al reinicio (Priority: P1)

Como usuario, quiero seguir autenticado después de que el servidor se reinicie o de que yo despliegue una versión nueva, para no tener que volver a entrar cada vez.

**Why this priority**: El usuario captura facturas desde el celular, en la calle, apenas se las entregan. Una sesión que se cae con cada despliegue o reinicio rompe justo ese flujo de uso diario que es la razón de ser del sistema.

**Independent Test**: Se prueba iniciando sesión, reiniciando el sistema (o redesplegando), y verificando que la sesión sigue activa sin volver a autenticarse; y verificando por separado que un archivo de factura responde con error sin una sesión válida.

**Acceptance Scenarios**:

1. **Given** una sesión iniciada, **When** el sistema se reinicia o se redespliega, **Then** el usuario sigue autenticado sin volver a ingresar sus credenciales.
2. **Given** el sistema corriendo detrás de la capa que termina HTTPS (proxy inverso), **When** el usuario inicia sesión, **Then** la sesión se establece correctamente (hoy, en ese escenario, no se establecería).
3. **Given** varios intentos fallidos consecutivos de inicio de sesión contra la misma cuenta, **When** se supera una cantidad razonable de intentos, **Then** los intentos siguientes quedan bloqueados temporalmente.
4. **Given** un archivo de imagen de una factura, **When** se solicita sin una sesión válida y dueña de esa factura, **Then** el sistema lo rechaza — nunca es accesible de forma anónima.

---

### User Story 3 - Procesar el backlog completo sin tumbar el sistema (Priority: P1)

Como usuario, quiero subir decenas de facturas de una sola vez y que todas terminen procesadas, sin que el servidor se quede sin memoria ni que el proveedor de extracción rechace las solicitudes por exceso.

**Why this priority**: El caso de uso real de arranque es subir un backlog físico acumulado, no solo facturas sueltas. Si el sistema no soporta eso de forma confiable, el usuario no puede empezar a usarlo en serio.

**Independent Test**: Se prueba subiendo un lote de 80 archivos de una sola vez y verificando que las 80 facturas terminan en un estado final del pipeline existente (nunca fallidas por saturación del propio sistema, solo por motivos reales de extracción).

**Acceptance Scenarios**:

1. **Given** un lote de 80 archivos subidos de una sola vez, **When** el sistema los procesa, **Then** los 80 documentos terminan en un estado final; ninguno queda fallido por saturación.
2. **Given** un lote grande en proceso, **When** se observa el comportamiento del sistema, **Then** las extracciones se disparan de forma controlada, nunca todas al mismo tiempo.
3. **Given** un archivo que excede el tamaño máximo configurado, o un lote que excede la cantidad máxima configurada, **When** el usuario intenta subirlo, **Then** recibe un mensaje claro indicando el límite excedido.
4. **Given** un lote en proceso de subida y extracción, **When** el usuario observa la pantalla de captura, **Then** puede ver cuántos documentos ya se procesaron y cuántos quedan pendientes.

---

### User Story 4 - Ninguna factura queda atascada (Priority: P2)

Como usuario, quiero que ningún documento quede indefinidamente "procesando" cuando el sistema se reinicia a mitad de una extracción, para no tener registros muertos que no puedo reintentar.

**Why this priority**: Es una consecuencia directa de operar en un VPS real (reinicios, redespliegues, caídas) más que un riesgo del día a día — importante, pero depende de que US1-US3 ya existan para poder manifestarse.

**Independent Test**: Se prueba deteniendo el proceso de la API a mitad de una extracción en curso y verificando que, al volver a arrancar, esa factura queda en un estado desde el cual se puede reintentar, con el evento visible en el log.

**Acceptance Scenarios**:

1. **Given** una factura en estado "procesando" cuando el sistema se detiene abruptamente, **When** el sistema vuelve a arrancar, **Then** esa factura queda en un estado desde el cual el usuario puede reintentar la extracción.
2. **Given** la recuperación de una factura atascada al arranque, **When** ocurre, **Then** usa exclusivamente transiciones ya definidas en la máquina de estados existente — no introduce ninguna nueva.
3. **Given** una recuperación al arranque, **When** ocurre, **Then** queda registrada en el log del sistema.

---

### User Story 5 - Puedo recuperar todo si el servidor se pierde (Priority: P1)

Como usuario, quiero copias de respaldo automáticas de la base de datos y de las imágenes hacia un destino externo al servidor, para poder reconstruir mi historial completo si el VPS se pierde. Estas facturas soportan mi declaración de renta y pueden ser requeridas años después.

**Why this priority**: Es la contraparte directa del Principio I de la constitution ("la evidencia nunca se pierde"). Sin esto, todo lo demás vive con un único punto de falla: el disco de un solo VPS.

**Independent Test**: Se prueba ejecutando el respaldo, confirmando que el archivo cifrado llega al destino externo, y luego restaurando ese respaldo en un servidor limpio hasta verificar que las facturas e imágenes coinciden exactamente con el origen.

**Acceptance Scenarios**:

1. **Given** el sistema desplegado, **When** pasa la hora programada, **Then** el respaldo de base de datos e imágenes se ejecuta automáticamente, sin intervención del usuario.
2. **Given** un respaldo generado, **When** se completa, **Then** queda cifrado y almacenado en un destino externo al servidor.
3. **Given** un respaldo existente, **When** se sigue el procedimiento de restauración documentado sobre un servidor nuevo, **Then** el sistema queda funcionando con los mismos datos e imágenes que tenía el respaldo — este procedimiento MUST haberse probado al menos una vez de principio a fin.
4. **Given** varios días de respaldos acumulados, **When** el usuario los revisa, **Then** encuentra un histórico de varios días, no solo la copia más reciente.
5. **Given** el respaldo automático de la noche anterior, **When** el usuario quiere confirmar su resultado, **Then** puede saber si falló o se completó sin tener que leer logs técnicos en detalle.

---

### User Story 6 - Montos sin tope artificial (Priority: P1)

Como usuario, quiero registrar facturas de cualquier valor razonable (compras grandes: electrodomésticos, tratamientos médicos, vehículos) sin que el sistema falle por un límite interno de representación numérica.

**Why this priority**: Es un bug de corrección de datos, no una mejora — una factura real y legítima que el sistema no puede guardar es una pérdida de evidencia tributaria, lo mismo que prohíbe el Principio I.

**Independent Test**: Se prueba registrando (o corrigiendo manualmente) una factura con un valor superior a 21,4 millones de COP y verificando que se guarda, se lista y se suma correctamente en el reporte anual.

**Acceptance Scenarios**:

1. **Given** una factura por un valor muy superior a veinte millones de pesos, **When** se guarda, **Then** se persiste y se reporta correctamente, sin error ni truncamiento.
2. **Given** facturas con esos valores altos, **When** se calculan reportes y sumatorias, **Then** el resultado es exacto — ningún tipo numérico introducido pierde precisión.
3. **Given** los datos existentes antes de este cambio, **When** el cambio se aplica, **Then** esos datos se conservan intactos y siguen siendo correctos.

---

### User Story 7 - El sistema responde rápido con años de historial (Priority: P3)

Como usuario, quiero que el listado y los filtros sigan siendo rápidos cuando tenga miles de facturas acumuladas de varios años.

**Why this priority**: Es un problema que aparece con el tiempo, no desde el primer día de uso — importante para que el sistema siga siendo usable a largo plazo, pero no bloquea el uso inicial.

**Independent Test**: Se prueba cargando una cuenta con varios miles de facturas históricas y verificando que el listado filtrado y la búsqueda de duplicados responden dentro de un tiempo percibido como instantáneo.

**Acceptance Scenarios**:

1. **Given** una cuenta con varios miles de facturas acumuladas, **When** se filtra el listado por fecha, estado, comercio o elegibilidad, **Then** la respuesta no se degrada de forma notoria frente a una cuenta con pocas facturas.
2. **Given** ese mismo volumen, **When** el sistema busca posibles duplicados por identificador único (CUFE), **Then** la búsqueda resuelve de forma prácticamente inmediata.

---

### User Story 8 - Sé si el sistema está sano (Priority: P3)

Como usuario, quiero una forma rápida de saber si el sistema y sus dependencias están funcionando, para diagnosticar sin entrar a leer logs.

**Why this priority**: Es una herramienta de diagnóstico operativo, útil pero no crítica para el uso diario del sistema en sí.

**Independent Test**: Se prueba consultando el punto de verificación de salud y confirmando que refleja correctamente el estado de la aplicación y de la base de datos, incluyendo cuando una de las dos falla.

**Acceptance Scenarios**:

1. **Given** el sistema funcionando con normalidad, **When** se consulta el punto de verificación de salud, **Then** reporta el estado de la aplicación y de la base de datos.
2. **Given** un error registrado en el log, **When** se revisa, **Then** tiene contexto suficiente para diagnosticar y nunca incluye claves de API ni contraseñas.

---

### Out of Scope

- Alta disponibilidad, réplicas o balanceo de carga — es un sistema personal de un solo usuario, no lo requiere.
- Monitoreo con herramientas externas o alertas sofisticadas más allá del punto de verificación de salud (US8).
- Un pipeline de CI/CD automatizado que dispare el despliegue — un procedimiento de despliegue manual pero reproducible (US1) es suficiente para esta feature; automatizarlo queda para más adelante.
- Migrar el almacenamiento de imágenes a un servicio de objetos en la nube — las imágenes siguen viviendo en el volumen del propio servidor (con respaldo externo, US5), no se cambia dónde vive el original.

### Edge Cases

- ¿Qué pasa si el proveedor de extracción empieza a rechazar solicitudes por límite de tasa a mitad de un lote grande — las facturas restantes quedan en un estado reintentable, o el lote entero se pierde?
- ¿Qué pasa si el respaldo automático falla dos noches seguidas — el usuario se entera de cada falla individual, o solo de la más reciente?
- ¿Qué pasa si el servidor se queda sin espacio en disco a mitad de un respaldo o de la subida de un lote grande?
- ¿Qué pasa si el certificado HTTPS no logra renovarse automáticamente antes de expirar?
- ¿Qué pasa si se intenta restaurar un respaldo sobre un servidor que ya tiene datos (no está limpio)?
- ¿La recuperación al arranque (US4) toca solamente facturas en "procesando", o también otros estados intermedios que pudieran quedar inconsistentes por una interrupción?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST poder desplegarse completo (base de datos, API, interfaz web, capa de acceso público HTTPS) en un servidor nuevo mediante un único comando y un archivo de configuración, sin pasos manuales adicionales no documentados.
- **FR-002**: El sistema MUST aplicar automáticamente cualquier cambio de esquema de base de datos pendiente como parte del despliegue, sin que el usuario ejecute migraciones a mano.
- **FR-003**: Las imágenes originales de las facturas y sus archivos derivados MUST persistir a través de la recreación de los contenedores del sistema.
- **FR-004**: La base de datos MUST permanecer inaccesible desde fuera de la infraestructura del propio servidor.
- **FR-005**: El sistema MUST negarse a arrancar si falta o es inválida alguna configuración obligatoria, informando con un mensaje claro cuál falta, en vez de arrancar en un estado parcial.
- **FR-006**: La sesión de un usuario autenticado MUST permanecer válida después de un reinicio del sistema o de un redespliegue de una versión nueva.
- **FR-007**: El inicio de sesión MUST funcionar correctamente cuando las peticiones llegan a través de la capa que termina HTTPS (proxy inverso), sin degradar la seguridad de la cookie de sesión.
- **FR-008**: El sistema MUST bloquear temporalmente los intentos de inicio de sesión después de un número razonable de intentos fallidos consecutivos contra la misma cuenta.
- **FR-009**: Los archivos de imagen de una factura (original y derivados) MUST ser accesibles únicamente para un usuario con sesión activa y dueño de esa factura — nunca de forma anónima.
- **FR-010**: El sistema MUST aceptar la subida de un lote de múltiples archivos en una sola operación del usuario.
- **FR-011**: El sistema MUST procesar las extracciones de un lote de forma controlada (con un límite de extracciones simultáneas), de modo que ningún documento falle por saturación de memoria del sistema o por los límites del proveedor de extracción.
- **FR-012**: El sistema MUST aplicar un límite configurable de tamaño máximo por archivo subido, informando con un mensaje claro cuando se excede.
- **FR-013**: El sistema MUST aplicar un límite configurable de cantidad máxima de archivos por lote, informando con un mensaje claro cuando se excede.
- **FR-014**: Durante la subida y el procesamiento de un lote, el usuario MUST poder ver cuántos documentos ya terminaron de procesarse y cuántos quedan pendientes.
- **FR-015**: Al arrancar, el sistema MUST detectar cualquier factura que haya quedado en estado "procesando" por una interrupción previa y transicionarla a un estado desde el cual el usuario pueda reintentar la extracción, usando exclusivamente transiciones ya definidas en la máquina de estados existente.
- **FR-016**: Cada recuperación de una factura atascada al arranque MUST quedar registrada en el log del sistema.
- **FR-017**: El sistema MUST ejecutar automáticamente, sin intervención del usuario, un respaldo diario de la base de datos y de las imágenes de facturas.
- **FR-018**: Cada respaldo MUST cifrarse y almacenarse en un proveedor de almacenamiento de objetos de terceros, externo al servidor, antes de darse por completo.
- **FR-018a**: La llave de cifrado del respaldo MUST configurarse como un secreto del servidor (variable de entorno), y MUST además quedar documentada/guardada por el usuario en un lugar fuera del propio servidor — nunca únicamente en la máquina que se está respaldando, para que la pérdida del servidor no vuelva indescifrables sus propios respaldos.
- **FR-019**: El sistema MUST conservar un histórico de varios respaldos recientes, no solo el más reciente, con una política de retención definida.
- **FR-020**: MUST existir un procedimiento de restauración documentado que, a partir de un respaldo, deje el sistema funcionando con los mismos datos e imágenes que tenía al momento de ese respaldo — y ese procedimiento MUST haberse probado al menos una vez de principio a fin antes de considerarse completo.
- **FR-021**: El usuario MUST poder saber si el respaldo automático de la noche anterior se completó correctamente o falló, sin tener que leer logs técnicos en detalle.
- **FR-022**: El sistema MUST permitir registrar facturas con montos muy superiores al límite práctico actual (~21,4 millones de COP), sin fallar ni truncar el valor.
- **FR-023**: Todo cálculo y sumatoria sobre montos (reportes, totales, conciliación) MUST mantener precisión exacta también para esos montos más altos — ningún tipo numérico usado MUST introducir pérdida de precisión.
- **FR-024**: Los datos monetarios ya existentes antes de este cambio MUST conservarse intactos y seguir siendo correctos después de aplicarlo.
- **FR-025**: El listado de facturas y sus filtros (fecha, estado, comercio, elegibilidad) MUST seguir respondiendo sin degradación notoria cuando la cuenta acumula varios años de historial.
- **FR-026**: La búsqueda de facturas duplicadas por identificador único (CUFE) MUST resolver de forma prácticamente inmediata incluso con un historial grande.
- **FR-027**: El sistema MUST exponer un punto de verificación de salud que reporte el estado de la aplicación y de su conexión a la base de datos.
- **FR-028**: Todo error registrado en el log MUST incluir contexto suficiente para diagnosticar la causa, y MUST NOT incluir claves de API, contraseñas, ni otros secretos.

### Key Entities *(include if feature involves data)*

- **Respaldo**: un snapshot cifrado, con fecha y hora, de la base de datos y las imágenes en un momento dado. Tiene un resultado (exitoso/fallido) consultable por el usuario y una fecha de expiración según la política de retención.
- **Evento de recuperación al arranque**: registro de que una factura fue transicionada automáticamente desde "procesando" a un estado reintentable por una interrupción del sistema — incluye la factura afectada, el estado origen/destino y el momento en que ocurrió.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Desde un servidor recién aprovisionado, el sistema queda accesible por HTTPS en un dominio propio en menos de 15 minutos siguiendo el procedimiento documentado.
- **SC-002**: Un lote de 80 facturas subidas de una sola vez termina, sin intervención adicional, con el 100% de los documentos en un estado final del pipeline — ninguno fallido por saturación del propio sistema.
- **SC-003**: Tras reiniciar el sistema o redesplegar una versión nueva, el 100% de las sesiones activas previas siguen autenticadas, sin pedir volver a iniciar sesión.
- **SC-004**: Una factura con un valor superior a 21,4 millones de COP se guarda, se lista y se suma en el reporte anual con el mismo nivel de exactitud que cualquier otra factura.
- **SC-005**: Tras destruir el servidor por completo y restaurar desde el respaldo más reciente en un servidor nuevo, el 100% de las facturas y sus imágenes originales quedan disponibles e idénticas a como estaban antes de la pérdida.
- **SC-006**: El usuario puede confirmar en menos de 1 minuto, sin leer logs técnicos, si el respaldo automático de la noche anterior se completó o falló.
- **SC-007**: El listado filtrado responde en un tiempo percibido como instantáneo (sub-segundo) incluso con miles de facturas acumuladas de varios años.
- **SC-008**: Una factura que queda "procesando" por una interrupción del sistema nunca permanece así de forma indefinida — siempre queda en un estado reintentable en el siguiente arranque.

## Assumptions

- El límite de tamaño máximo por archivo se define por defecto en un valor generoso para fotos de celular (del orden de 15-20 MB), configurable sin cambiar código.
- El límite de cantidad de archivos por lote se define por defecto en un valor que cubre cómodamente el caso de uso descrito (80 facturas), configurable sin cambiar código.
- El umbral de bloqueo por intentos fallidos de inicio de sesión usa un valor estándar de la industria (por ejemplo, 5 intentos en una ventana de 15 minutos), salvo que se decida otro al planear.
- La retención de respaldos es de al menos 14 días — mismo valor ya en uso por el mecanismo de respaldo de base de datos existente (`scripts/backup-db.sh`) — salvo que se decida otro valor al planear.
- El dominio propio y su registro DNS apuntando al VPS ya existen o se gestionan fuera de esta feature; esta feature cubre la configuración del servidor, no la compra/gestión del dominio.
- El proveedor de almacenamiento externo para el respaldo (FR-018) es de bajo costo (del orden de centavos de USD por GB al mes), de modo que sumarlo no compromete el objetivo constitucional de menos de 15 USD/mes; el usuario crea la cuenta y provee las credenciales, ya que esta feature no puede crear cuentas de terceros por su cuenta.
- El proveedor de extracción (Claude Sonnet 5, ya en uso) mantiene sus propios límites de tasa; el procesamiento controlado de esta feature se diseña para mantenerse por debajo de esos límites, sin asumir un cambio de proveedor.
- Esta feature no rediseña la interfaz ni agrega funcionalidad de negocio nueva — es exclusivamente sobre que el sistema ya construido funcione de forma confiable, recuperable y segura en producción.
- El respaldo de imágenes reutiliza o extiende el mecanismo ya existente para la base de datos, en vez de construir uno completamente aparte.
