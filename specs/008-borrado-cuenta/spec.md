# Feature Specification: Borrado de Cuenta con Purga Diferida

**Feature Branch**: `001-captura-facturas` (rama troncal real del proyecto; ver nota en plan.md)

**Created**: 2026-10-27

**Status**: Draft

**Input**: User description: "Borrado de cuenta in-app con purga diferida, requerido por App Store Review Guideline 5.1.1(v) (toda app que permite crear cuenta debe permitir borrarla desde la app; desactivar no alcanza) y por habeas data básico. Decisión de diseño ya tomada por el usuario (no renegociable): al confirmar el borrado, la cuenta queda inaccesible al instante (no es una desactivación) y los archivos originales de las facturas entran a una cola de purga física irreversible a 30 días. Si fue un error, hay ventana de 30 días para revertir antes de la destrucción física real."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Un usuario borra su propia cuenta desde la app (Priority: P1)

Un usuario autenticado decide dejar de usar Cufeo. Desde la configuración de su cuenta, dentro de la misma app, inicia el borrado, confirma de forma deliberada que entiende las consecuencias, y la cuenta queda inaccesible de inmediato.

**Why this priority**: Es el requisito bloqueante para poder enviar la app a revisión de Apple (Guideline 5.1.1(v): toda app que permite crear una cuenta debe permitir borrarla desde dentro de la app; una simple desactivación no es aceptada). Sin esto, no hay publicación posible.

**Independent Test**: Crear una cuenta de prueba con al menos una factura cargada, solicitar el borrado desde la app, y confirmar que un intento de inicio de sesión inmediatamente después es rechazado.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado con su cuenta activa, **When** solicita el borrado y confirma de forma deliberada, **Then** la cuenta queda inaccesible de inmediato y se le informa que tiene 30 días para revertirlo.
2. **Given** un usuario que llegó a la pantalla de borrado, **When** no completa la confirmación deliberada (por ejemplo cierra el diálogo), **Then** la cuenta sigue activa y nada cambia.
3. **Given** una cuenta con facturas en distintos estados (procesando, con duplicados pendientes, con validación DIAN pendiente), **When** su titular solicita el borrado, **Then** la solicitud se acepta sin que esos estados intermedios la bloqueen.

---

### User Story 2 - Un usuario revierte un borrado solicitado por error (Priority: P1)

Dentro de los 30 días posteriores a solicitar el borrado, el usuario cambia de opinión (o alguien más usó la cuenta por error) e intenta volver a entrar a Cufeo. El sistema reconoce que esa cuenta tiene una eliminación programada y le ofrece cancelarla.

**Why this priority**: Es la contrapartida necesaria de que el borrado sea "instantáneo e irreversible en apariencia" — sin una vía real de revertirlo, un error humano destruye evidencia tributaria real (facturas, soportes) sin posibilidad de vuelta atrás. Tiene la misma prioridad que la Historia 1 porque ambas son caras de la misma garantía que el usuario ya exigió.

**Independent Test**: Solicitar el borrado de una cuenta de prueba con facturas reales, intentar iniciar sesión al día siguiente, cancelar la eliminación programada, y confirmar que todas las facturas siguen intactas, accesibles y sin ninguna pérdida de datos.

**Acceptance Scenarios**:

1. **Given** una cuenta con una eliminación programada dentro de los 30 días, **When** su titular intenta iniciar sesión, **Then** se le informa del estado y se le ofrece cancelar la eliminación en vez de completar un login normal.
2. **Given** una cuenta con eliminación programada, **When** su titular cancela la eliminación, **Then** la cuenta vuelve a funcionar exactamente como antes, con todos sus datos y facturas intactos.
3. **Given** una cuenta con eliminación programada que su titular decide NO cancelar, **When** pasan los 30 días sin ninguna acción, **Then** la purga ocurre igual que si nunca hubiera vuelto a intentar entrar.

---

### User Story 3 - Los datos se destruyen físicamente al vencer el plazo, sin intervención manual (Priority: P2)

Nadie revierte una eliminación programada dentro de los 30 días. Al vencer el plazo, el sistema destruye de forma irreversible los archivos originales y derivados de esa cuenta y borra el registro de la cuenta, sin que nadie tenga que accionar nada a mano.

**Why this priority**: Es lo que hace real la promesa de las Historias 1 y 2 — sin esta pieza, "borrar la cuenta" es cosmético (la cuenta queda inactiva pero los datos siguen ahí para siempre), lo cual tanto Apple como un criterio básico de habeas data rechazan igual que la simple desactivación. Prioridad P2 porque depende de que la 1 y la 2 ya existan primero.

**Independent Test**: Llevar una cuenta de prueba con eliminación programada hasta el vencimiento del plazo (simulando el paso del tiempo) y confirmar que, después, ni los archivos ni el registro de la cuenta existen en ningún lugar del sistema, y que cualquier solicitud sobre esa cuenta responde igual que para una cuenta que nunca existió.

**Acceptance Scenarios**:

1. **Given** una cuenta con eliminación programada cuyo plazo de 30 días ya venció sin reversión, **When** se ejecuta la purga, **Then** los archivos originales y derivados de esa cuenta quedan destruidos de forma irreversible y el registro de la cuenta deja de existir.
2. **Given** una cuenta ya purgada, **When** cualquiera intenta acceder a sus datos, iniciar sesión, o consultarla por cualquier vía, **Then** la respuesta es idéntica a la de una cuenta que nunca existió.
3. **Given** que el proceso de purga se ejecuta más de una vez sobre la misma cuenta vencida (por ejemplo por un reintento), **When** corre la segunda vez, **Then** no falla ni produce ningún efecto adicional (es seguro repetirlo).

### Edge Cases

- ¿Qué pasa si llegan dos solicitudes de borrado casi simultáneas para la misma cuenta (doble clic, doble pestaña)? No debe quedar un estado inconsistente ni dos purgas programadas con fechas distintas para la misma cuenta.
- ¿Qué pasa si alguien intenta usar la API directamente (no la pantalla) sobre una cuenta con eliminación programada, para algo que no sea revertirla? Debe comportarse como si la cuenta no estuviera disponible para cualquier otro uso.
- ¿Qué pasa si el proceso que ejecuta la purga se interrumpe a la mitad (por ejemplo el servidor se reinicia mientras está borrando archivos)? Al retomar, debe poder completar la purga de esa cuenta sin duplicar trabajo ni dejarla en un estado parcialmente purgado de forma permanente.
- ¿Qué pasa si se solicita el borrado de una cuenta que ya tiene una eliminación programada en curso? La solicitud no debe reiniciar el plazo de 30 días ni crear una segunda purga paralela.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir a cualquier usuario autenticado iniciar el borrado de su propia cuenta completamente dentro de la app, sin necesitar salir de ella, enviar un correo, o contactar soporte humano.
- **FR-002**: El sistema MUST exigir una confirmación deliberada e inequívoca antes de ejecutar el borrado — un solo toque o clic accidental no MUST ser suficiente para iniciarlo.
- **FR-003**: El sistema MUST volver la cuenta completamente inaccesible de inmediato tras confirmar el borrado, incluyendo el cierre inmediato de cualquier sesión ya abierta en cualquier dispositivo — no puede seguir operando como una cuenta activa durante la ventana de reversión.
- **FR-004**: El sistema MUST conservar los archivos originales, los archivos derivados y todos los datos de la cuenta intactos y recuperables durante una ventana de 30 días calendario desde el momento en que se confirmó el borrado.
- **FR-005**: El sistema MUST ofrecer a su titular, dentro de esos 30 días, una forma de revertir el borrado y recuperar acceso completo a su cuenta y a todos sus datos, sin pérdida alguna.
- **FR-006**: El sistema MUST informar al usuario, en el mismo momento de confirmar el borrado, cuánto dura la ventana de reversión y qué sucede de forma irreversible una vez que vence.
- **FR-007**: El sistema MUST destruir de forma física e irreversible los archivos originales, los archivos derivados y el registro completo de la cuenta una vez transcurridos los 30 días sin que su titular haya revertido el borrado, sin requerir ninguna acción manual para que esto ocurra.
- **FR-008**: El sistema MUST tratar cualquier solicitud de lectura o escritura sobre una cuenta ya purgada exactamente igual que si esa cuenta nunca hubiera existido — ninguna respuesta MUST revelar que existió alguna vez.
- **FR-009**: El sistema MUST aceptar una solicitud de borrado sin importar el estado de procesamiento, revisión o validación en que estén las facturas de esa cuenta en ese momento.
- **FR-010**: El sistema MUST ser capaz de ejecutar la purga de una cuenta vencida más de una vez sin fallar ni producir efectos adicionales (idempotencia) y MUST poder completarla aunque haya sido interrumpida a la mitad.
- **FR-011**: El sistema MUST impedir que una cuenta con una eliminación ya programada quede con una segunda purga paralela o con el plazo de 30 días reiniciado por una nueva solicitud sobre la misma cuenta.
- **FR-012**: El sistema MUST registrar de forma auditable el momento en que se solicitó cada borrado y el momento en que se ejecutó cada purga, para poder demostrar cumplimiento ante una revisión.

### Key Entities

- **Eliminación programada**: el estado de una cuenta que ya confirmó su borrado — inaccesible para uso normal, con una fecha de purga definitiva fijada 30 días después de la solicitud, y reversible por su titular hasta esa fecha.
- **Purga**: la operación irreversible que, al llegar la fecha de purga definitiva, destruye físicamente los archivos originales y derivados de una cuenta y elimina su registro por completo, sin dejar rastro recuperable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario puede completar la solicitud de borrado de su cuenta, desde que decide hacerlo hasta la confirmación final, en menos de 1 minuto y sin salir de la app.
- **SC-002**: El 100% de los intentos de uso normal (inicio de sesión, lectura, escritura) sobre una cuenta con eliminación programada son rechazados de inmediato — ninguna ventana de tiempo la deja operar como cuenta activa.
- **SC-003**: El 100% de las cuentas cuya ventana de 30 días vence sin reversión terminan purgadas (archivos y registro destruidos) sin ninguna intervención manual.
- **SC-004**: El 100% de las solicitudes sobre una cuenta ya purgada reciben una respuesta idéntica a la de una cuenta inexistente.

## Assumptions

- La reversión dentro de los 30 días es autoservicio: intentar iniciar sesión de nuevo dentro del plazo ofrece la opción de cancelar la eliminación programada, sin necesitar un proceso de soporte humano. Este proyecto no tiene infraestructura de soporte, y este patrón (login dentro de la ventana de gracia cancela la eliminación pendiente) es ampliamente aceptado por Apple en apps ya publicadas.
- La ventana es de 30 días calendario exactos desde la confirmación del borrado, sin importar cuánto tiempo pase el usuario sin volver a intentar iniciar sesión.
- Esta feature requiere una excepción explícita al principio de inmutabilidad de evidencia de la constitución del proyecto, para el caso específico de "borrado iniciado por el propio titular de la cuenta, con ventana de reversión de 30 días". La redacción final de esa excepción se resuelve en un paso de gobernanza separado (enmienda de constitución), no en esta spec.
- Quedan fuera de alcance de esta feature: la decisión sobre proveedores de inicio de sesión social (incluyendo Sign in with Apple), el refactor de tipos compartidos del cliente web (`apps/web` consumiendo `@myivo/domain`), y la enmienda del techo de costo operativo y la política de notificaciones de la constitución — son items separados del mismo plan más amplio.
