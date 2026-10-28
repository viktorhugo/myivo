# Research: Borrado de Cuenta con Purga Diferida

## D1 — Qué dispara el borrado inmediato, y qué NO

**Decision**: El endpoint propio de borrado (`POST /cuenta/eliminar`, siguiendo el molde de
`cuenta.controller.ts`) NO llama al endpoint nativo `/delete-user` de Better Auth. En su lugar:
marca `User.eliminacionProgramadaPara = now() + 30 días` y revoca explícitamente todas las
sesiones activas de esa cuenta (`prisma.session.deleteMany({ where: { userId } })`).

**Rationale**: `user.deleteUser` de Better Auth 1.6.25 (`internalAdapter.deleteUser`) es un
borrado inmediato y duro del `User`, sin ventana de gracia nativa — incompatible con FR-004/
FR-005. Además, llamarlo hoy fallaría a nivel de base de datos mientras existan `Factura` que
referencian a ese `usuarioId` (`schema.prisma:166`, sin `onDelete: Cascade`, a propósito). El
borrado real del `User` se pospone al día 30, cuando ya no hay Facturas que lo referencien.

**Alternatives considered**: Usar los hooks `beforeDelete`/`afterDelete` de Better Auth para
orquestar la ventana de gracia — descartado porque esos hooks solo corren si se invoca
`/delete-user`, y ese endpoint ya ejecuta el borrado duro en el mismo tick; no da un punto donde
"pausar" 30 días sin de todos modos necesitar un mecanismo externo de purga diferida.

## D2 — Cómo queda "inaccesible al instante" sin borrar el `User` todavía

**Decision**: `User.eliminacionProgramadaPara: DateTime?` nuevo. `SessionUsuarioGuard`
(`apps/api/src/modules/auth/guards/session-usuario.guard.ts`) se extiende: si la sesión resuelve
a un usuario con `eliminacionProgramadaPara` no nulo, el guard rechaza la request exactamente
igual que si no hubiera sesión (403) — con una única excepción: los endpoints dedicados de
estado/cancelación de la eliminación (`GET /cuenta/eliminacion`, `POST /cuenta/eliminacion/cancelar`)
siguen un camino propio que SÍ permite leer y limpiar ese campo.

**Rationale**: FR-003 exige que ninguna ventana de tiempo deje la cuenta operando como activa.
Revocar las sesiones (D1) cubre los dispositivos ya logueados; este chequeo en el guard cubre
cualquier sesión nueva que se cree después (ej. "recordarme" en el navegador, un token aún
válido). Las dos capas juntas son necesarias: una sin la otra deja un hueco.

## D3 — Cómo se revierte dentro de los 30 días

**Decision**: Iniciar sesión con credenciales válidas sobre una cuenta con
`eliminacionProgramadaPara` no nulo SÍ crea la sesión a nivel de Better Auth (las credenciales
son correctas), pero el guard (D2) la trata como inaccesible para cualquier ruta salvo
`GET /cuenta/eliminacion` (devuelve la fecha de purga programada) y
`POST /cuenta/eliminacion/cancelar` (pone el campo en `null`, cuenta vuelve a operar normal). El
cliente web, al detectar ese estado especial en vez de redirigir a la pantalla normal, muestra una
pantalla dedicada de "tu cuenta está programada para eliminación — cancelar / entendido".

**Rationale**: No hay infraestructura de soporte en este proyecto (confirmado en el mapeo de
código); exigir "contactar soporte" para revertir introduciría un proceso manual que no existe.
Login-dentro-de-la-ventana-cancela-la-eliminación es un patrón ya aceptado por Apple en apps
publicadas, y es la lectura que ya quedó documentada como supuesto en `spec.md` § Assumptions.

**Alternatives considered**: Bloquear también el login (no solo el resto de la app) durante la
ventana — descartado porque entonces no habría ninguna vía de autoservicio para revertir, y el
único camino quedaría siendo soporte humano inexistente.

## D4 — Qué proceso ejecuta la purga del día 30, y cómo

**Decision**: Igual que `scripts/backup-db.sh` (specs/007-despliegue-produccion), la purga no usa
un scheduler en proceso (no se agrega `@nestjs/schedule`). Se expone un comando standalone de
Nest (`NestFactory.createApplicationContext(AppModule)`) que reutiliza `FileStorageService`,
`PrismaService` y `aislarPorUsuario` tal como corre el pipeline real — invocado por un cron del
sistema operativo (documentado junto al cron de backup existente), una vez al día.

**Rationale**: El proyecto no tiene ningún precedente de scheduler en proceso (confirmado: sin
`@nestjs/schedule`, sin `setInterval`, sin `@Cron` en todo `apps/api/src`). El único precedente de
tarea recurrente es cron del host + script. A diferencia del backup (que es shell puro + `pg_dump`/
`age`/`rclone`, sin tocar Prisma), la purga sí necesita la capa de dominio (transacciones aisladas
por cuenta, reutilizar el storage de archivos) — de ahí un comando Nest standalone en vez de SQL
crudo, pero seguimos disparándolo por cron del sistema, no por un scheduler nuevo en el proceso.

**Alternatives considered**: `@nestjs/schedule` con un `@Cron` dentro de la API — descartado por
ser una dependencia nueva sin precedente en el proyecto, y porque el patrón cron-del-host ya
funciona, ya está documentado operativamente, y el operador (una sola persona) ya administra ese
crontab para el backup.

## D5 — Orden exacto de la purga (evita el problema de la FK)

**Decision**: Para cada `User` con `eliminacionProgramadaPara <= now()`: (1) listar y borrar
físicamente todos los archivos originales y derivados de sus Facturas (nuevo método en
`FileStorageService`); (2) `prisma.factura.deleteMany({ where: { usuarioId } })`; (3)
`prisma.user.delete({ where: { id: usuarioId } })` (ya seguro: ninguna Factura lo referencia).
Todo el paso (1)+(2) corre dentro de `aislarPorUsuario` (transacción con RLS ya fijado), igual que
el resto del código de aislamiento entre cuentas.

**Rationale**: Resuelve exactamente la restricción de `schema.prisma:166` sin tocar
`onDelete: Cascade` (que seguiría destruyendo a futuro sin ventana de gracia si alguien borra un
`User` por otra vía). El orden archivo→Factura→User es el único que no viola ninguna FK existente.

**Alternatives considered**: Agregar `onDelete: Cascade` a `Factura.usuarioId` — descartado:
reintroduciría borrado automático e inmediato de Facturas por cualquier baja de `User` futura, sin
pasar por la ventana de 30 días ni por el borrado físico controlado de archivos (dejaría
`Factura` borrada pero el archivo en disco huérfano, violando igual la intención del Principio I).

## D6 — Idempotencia y reinicio a mitad de camino (FR-010, edge case)

**Decision**: El comando de purga es seguro de reintentar: selecciona candidatos por
`eliminacionProgramadaPara <= now()` (no por un flag de "en progreso"), y cada paso usa
operaciones que ya son no-op si no hay nada que borrar (`deleteMany` sobre filas inexistentes no
falla; borrar un archivo que ya no existe se trata como éxito, no como error). Si el proceso muere
entre el paso (1) y (3), la siguiente corrida retoma desde donde quedó sin duplicar trabajo.

**Rationale**: Cubre el edge case de "el proceso que ejecuta la purga se interrumpe a la mitad"
sin necesitar una máquina de estados nueva — el propio campo `eliminacionProgramadaPara` más la
ausencia de archivos/filas ya marca el progreso real.

## D7 — Auditoría (FR-012)

**Decision**: `User` suma dos campos: `eliminacionSolicitadaEn: DateTime?` (momento de la
solicitud, nunca se borra aunque se cancele — queda como historial si se vuelve a pedir) y
`eliminacionProgramadaPara: DateTime?` (la fecha de purga vigente, se limpia si se cancela). El
comando de purga escribe una línea de log estructurado (mismo patrón de logging ya usado en
`RecuperacionArranqueService`) con el id de usuario (no datos personales) al completar cada purga.

**Rationale**: Suficiente para demostrar cumplimiento (cuándo se pidió, cuándo se ejecutó) sin
requerir una tabla de auditoría nueva — consistente con el nivel de instrumentación ya existente en
el proyecto (logs estructurados, no un sistema de auditoría dedicado).
