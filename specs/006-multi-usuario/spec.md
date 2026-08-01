# Feature Specification: Registro abierto con aislamiento total entre usuarios

**Feature Branch**: `006-multi-usuario`

**Created**: 2026-07-29

**Status**: Draft

**Input**: User description: "Implementar el multi-usuario real habilitado por la enmienda del Principio VII de la constitution (v2.0.0, 2026-07-29): la misma instancia autoalojada admite varias cuentas de usuario, cada una con sus propias facturas, completamente aislada de las demás — ninguna cuenta puede ver, listar, reportar, ni de ninguna forma acceder a los datos de otra. Hoy el sistema tiene un solo usuario hardcodeado por variables de entorno (AUTH_USERNAME/AUTH_PASSWORD_HASH) y ningún dato tiene dueño (Factura y todo lo que depende de ella no tienen usuarioId). Los datos ya capturados por Victor bajo el modelo actual deben migrar a su propia cuenta nueva, sin pérdida. Todas las features ya existentes que consultan o agregan datos (Listado, Detalle, duplicados, validación DIAN, conciliación en lote, reporte anual) deben quedar acotadas a la cuenta que las usa. El registro de cuentas nuevas es abierto: cualquier persona puede crear su propia cuenta desde la app, no solo quien opera la instancia."

## Clarifications

### Session 2026-07-30

- Q: ¿Cómo se crean cuentas nuevas — solo quien opera la instancia las crea, o cualquier persona puede registrarse por su cuenta? → A: Registro abierto — cualquier persona puede crear su propia cuenta desde la app, sin depender de que alguien más se la cree.
- Q: ¿El registro abierto exige verificar el correo antes de poder usar la cuenta? → A: Sí — verificación de correo obligatoria antes del primer uso; es la única barrera de entrada.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registro abierto con verificación de correo y aislamiento total de datos (Priority: P1)

Como cualquier persona que quiera empezar a usar la instancia, quiero poder crear mi propia cuenta directamente desde la app (sin depender de que alguien más me la cree), y que desde el primer momento mis facturas, mis reportes, y todo lo que capture o corrija sean visibles únicamente para mí — nadie más que use la misma instancia debe poder ver, listar, ni acceder de ninguna forma a mis datos, y yo tampoco a los suyos.

**Why this priority**: Combina los dos requisitos no negociables de la enmienda constitucional: cómo nace una cuenta (registro abierto, no creada a mano por un tercero) y qué garantiza una vez existe (aislamiento total). Sin esto no hay "multi-usuario" real — hay una fuga de privacidad, o una barrera de entrada que nadie pidió.

**Independent Test**: Sin que nadie más intervenga, dos personas distintas se registran por su cuenta, verifican su correo, capturan sus propias facturas, corrigen campos, concilian con la DIAN, y consultan su reporte anual — se verifica que ninguna de las dos puede ver, listar, ni acceder (ni siquiera por un enlace directo con el ID de un registro ajeno) a ningún dato de la otra, en ninguna pantalla ni endpoint existente.

**Acceptance Scenarios**:

1. **Given** que alguien quiere empezar a usar la instancia, **When** se registra con su propio correo y contraseña, **Then** el sistema le exige verificar su correo antes de poder capturar su primera factura o ver cualquier dato.
2. **Given** una cuenta recién registrada pero sin verificar su correo, **When** intenta iniciar sesión o usar la app, **Then** el sistema se lo impide hasta que complete la verificación.
3. **Given** dos cuentas distintas ya verificadas, **When** cada una inicia sesión con su propio correo y contraseña, **Then** cada una ve únicamente las facturas que ella misma capturó.
4. **Given** una factura capturada por la cuenta A, **When** la cuenta B intenta acceder a ella directamente (por su identificador, adivinado o copiado de algún lado), **Then** el sistema responde igual que si esa factura no existiera — nunca revela que pertenece a otra cuenta.
5. **Given** dos cuentas que compraron en el mismo comercio, el mismo día, por el mismo monto, **When** el sistema evalúa posibles duplicados (feature 001/002), **Then** nunca las compara entre sí — la detección de duplicados ocurre únicamente dentro de los datos de una misma cuenta.
6. **Given** una cuenta que sube su propio Excel de conciliación con la DIAN (feature 003), **When** el sistema concilia, **Then** solo marca como conciliadas facturas de esa misma cuenta, nunca las de otra.
7. **Given** una cuenta que consulta su reporte anual (feature 004), **When** ve el total, el desglose, o lo exporta, **Then** el resultado refleja exclusivamente sus propias facturas elegibles.
8. **Given** los datos que Victor ya había capturado antes de esta feature (bajo el modelo de un solo usuario), **When** la migración a cuentas reales se completa, **Then** todos esos datos quedan asignados a una cuenta nueva de Victor (ya verificada, sin que él tenga que repetir el proceso de registro), sin pérdida ni exposición a ninguna otra cuenta.
9. **Given** la identificación tributaria propia de cada cuenta (hoy una variable de entorno compartida, `MIS_IDENTIFICACIONES`), **When** el sistema evalúa la elegibilidad de una factura (feature 001), **Then** la compara contra la identificación configurada de la cuenta dueña de esa factura, nunca contra una lista global compartida entre todas las cuentas.

---

### User Story 2 - Gestionar mi propia cuenta (Priority: P2)

Como titular de una cuenta ya registrada, quiero poder cambiar mi propia contraseña y configurar mi identificación tributaria propia (hoy una variable de entorno global) directamente desde la app, sin depender de que alguien más edite un archivo de configuración por mí.

**Why this priority**: User Story 1 ya entrega el valor central (registro abierto, verificación, y aislamiento total) — esta historia es sobre la comodidad de administrar mi propia cuenta hacia adelante, no sobre si el registro o el aislamiento funcionan.

**Independent Test**: Con una cuenta ya registrada y verificada (User Story 1), cambiar la contraseña y la identificación tributaria propia desde la app, y verificar que el cambio se refleja de inmediato (al iniciar sesión la próxima vez, y en la elegibilidad de la próxima factura capturada) sin tocar ningún archivo de configuración.

**Acceptance Scenarios**:

1. **Given** una cuenta ya verificada, **When** su titular cambia su propia contraseña desde la app, **Then** puede volver a iniciar sesión con la contraseña nueva, sin que nadie más haya intervenido.
2. **Given** una cuenta ya verificada, **When** su titular configura o corrige su identificación tributaria propia desde la app, **Then** la próxima factura que capture se evalúa contra esa identificación actualizada.

---

### Edge Cases

- Una cuenta intenta acceder a un recurso de otra cuenta por su identificador (URL directa, ID copiado, etc.): responde exactamente igual que ante un identificador que no existe en absoluto — nunca debe siquiera confirmar que el recurso existe bajo otra cuenta (Acceptance Scenario 4 de US1); el código de respuesta exacto es una decisión de `/speckit-plan`.
- Dos cuentas distintas capturan, por coincidencia, una factura idéntica en apariencia (mismo comercio, fecha, y total) porque compraron juntas o por separado en el mismo lugar: nunca se marcan como duplicado entre sí — la detección de duplicados es un concepto exclusivamente intra-cuenta.
- Alguien intenta registrarse con un correo que ya tiene una cuenta: el sistema lo rechaza de forma clara, sin crear una cuenta duplicada ni sobrescribir la existente.
- Una cuenta se registra pero nunca verifica su correo (abandona el proceso a medio camino): queda sin poder usarse, sin afectar a ninguna otra cuenta — eliminar cuentas no verificadas después de un tiempo queda fuera de alcance de esta feature (ver Assumptions).
- Una cuenta se elimina por completo (si esta feature llega a soportarlo) mientras tiene facturas capturadas: fuera de alcance de esta feature — ver Assumptions.
- Los datos ya existentes de Victor (capturados antes de esta feature) durante la ventana de migración: no deben quedar accesibles bajo ninguna cuenta hasta que la migración los asigne explícitamente a la cuenta nueva de Victor — nunca un estado intermedio "sin dueño pero visible".

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST reemplazar la autenticación actual de un solo usuario (variables de entorno `AUTH_USERNAME`/`AUTH_PASSWORD_HASH`) por registro abierto: cualquier persona MUST poder crear su propia cuenta desde la app, con su propio correo y contraseña, sin depender de que un tercero se la cree.
- **FR-002**: El sistema MUST exigir verificar el correo de una cuenta recién registrada antes de permitirle iniciar sesión, capturar facturas, o acceder a cualquier dato.
- **FR-003**: El sistema MUST asociar toda factura capturada (y todo lo que depende de ella: ítems, correcciones, marcas de posible duplicado, validaciones DIAN, extracción cruda) a la cuenta que la capturó.
- **FR-004**: El sistema MUST aislar completamente los datos entre cuentas en todas las funcionalidades ya existentes — Listado, Detalle, filtros, duplicados (feature 001/002), validación y conciliación DIAN (feature 003), reporte anual y su exportación (feature 004), captura desde PDF (feature 005). Ninguna combinación de filtro, consulta, o endpoint MUST exponer, contar, ni sumar datos de una cuenta distinta a la que hace la solicitud.
- **FR-005**: Acceder a un recurso que pertenece a otra cuenta (por identificador directo o cualquier otro medio) MUST comportarse exactamente igual que si el recurso no existiera — nunca debe revelar que existe bajo otra cuenta (Edge Cases).
- **FR-006**: La detección de posibles duplicados (feature 001/002) MUST evaluarse exclusivamente dentro de los datos de una misma cuenta — nunca comparar facturas de cuentas distintas entre sí.
- **FR-007**: Las identificaciones tributarias propias usadas por la regla de elegibilidad (feature 001, hoy la variable de entorno `MIS_IDENTIFICACIONES`) MUST ser una configuración propia de cada cuenta, editable desde la app (US2) — nunca un valor global compartido.
- **FR-008**: El sistema MUST migrar, en el momento de desplegar esta feature, los datos ya capturados bajo el modelo de un solo usuario a una cuenta real nueva de Victor, ya verificada, sin pérdida de información.
- **FR-009**: El sistema MUST permitir que el titular de una cuenta cambie su propia contraseña sin depender de que un tercero regenere un hash manualmente (US2).

### Key Entities *(include if feature involves data)*

- **Usuario** (entidad nueva): representa una cuenta — correo (identificador de inicio de sesión) y contraseña propios, un estado de verificación de correo (una cuenta no verificada no puede usarse), y su configuración de identificaciones tributarias propias (reemplaza `MIS_IDENTIFICACIONES`). Es el dueño de toda `Factura` que capture.
- **Factura** (existente, feature 001): gana una relación con `Usuario` — su dueño. Todo lo que ya depende de `Factura` (ítems, correcciones, marcas de duplicado, validaciones DIAN, extracción cruda) queda acotado a una cuenta transitivamente, a través de la factura a la que pertenece — no necesita su propia relación directa con `Usuario`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Dos cuentas usando la misma instancia nunca ven, cuentan, ni suman datos de la otra, en el 100% de las pantallas y endpoints ya existentes — cero excepciones.
- **SC-002**: Los datos capturados por Victor antes de esta feature siguen siendo accesibles, completos, y sin pérdida después de la migración.
- **SC-003**: Registrarse y verificar el correo, de principio a fin, toma menos de 2 minutos (sin contar el tiempo de espera del correo mismo) y no depende de que nadie más intervenga.
- **SC-004**: El costo operativo de la instancia sigue por debajo del objetivo constitucional (Principio VII) sin importar cuántas cuentas la usen, más allá del consumo de LLM (que escala con el uso real) y del envío de correos de verificación (volumen bajo, proporcional a los registros nuevos).

## Assumptions

- El registro es abierto — cualquier persona puede crear su propia cuenta desde la app, sin que nadie más la cree por ella (Clarifications, sesión 2026-07-30). La verificación de correo es la única barrera de entrada.
- Todas las cuentas son simétricas — no hay roles de administrador ni permisos diferenciados en esta fase; cada persona gestiona únicamente su propia cuenta (US2), nunca la de otra.
- Esta feature agrega una dependencia operativa nueva: un proveedor de envío de correo transaccional, necesario para la verificación de registro — es la primera vez que el sistema necesita enviar correos salientes. La elección exacta del proveedor es una decisión técnica de `/speckit-plan`.
- Cada cuenta declara su propia identificación tributaria (cédula/NIT) para la regla de elegibilidad (feature 001) — no existe ningún concepto de declaración conjunta ni de compras compartidas entre cuentas; la declaración de renta en Colombia es individual.
- Eliminar una cuenta completa (y qué pasa con sus facturas) queda fuera de alcance de esta feature — hoy las cuentas solo se crean, no se remueven.
- Compartir datos entre cuentas (p. ej., que una cuenta vea el reporte de otra) sigue sin existir — la forma de compartir información fuera de la propia cuenta sigue siendo la exportación ya existente (feature 004: Excel/PDF descargable), nunca acceso directo a los datos de otra cuenta.
- El mecanismo exacto de sesión/autenticación (tokens, cookies, librería específica) y cómo se garantiza técnicamente el aislamiento de datos (a nivel de aplicación, de base de datos, o ambos) son decisiones técnicas para `/speckit-plan` — esta feature solo exige que el aislamiento sea real y total, no una implementación concreta.
