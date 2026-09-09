# Pendientes — Despliegue en Producción

Lista de lo que quedó bloqueado en algo que solo vos podés hacer (cuenta real, VPS real, decisión de costo). Actualizada al cierre de la sesión del 2026-08-15 (tras completar US8 — las 8 historias ya están implementadas, solo queda Polish). El detalle completo de cada tarea, con lo que sí se verificó, está en [tasks.md](./tasks.md).

## Bloqueados en tu acción (US1-US6, ya implementadas)

- [ ] **Confirmar SC-001 en un VPS real** (T011) — todo lo demás ya se probó con Docker de verdad en local (build limpio, migraciones automáticas, fail-fast, `/health`), pero falta un VPS con dominio propio apuntando por DNS para confirmar HTTPS accesible en <15 min con Let's Encrypt real.
- [ ] **Confirmar que la sesión sobrevive a un restart con una cuenta real** (T015) — el rate limit (5 intentos → bloqueo) y el rechazo sin sesión ya se probaron en vivo. Falta solo: registrar una cuenta de verdad (con correo verificado), reiniciar el contenedor `api`, y confirmar que seguís logueado.
- [ ] **Probar el límite de tamaño de archivo con una sesión real** (T022) — `SessionUsuarioGuard` corre antes que Multer, así que no pude ejercer el límite de 20MB/archivo sin loguearme. Con una cuenta real: subí un archivo de más de 20MB y confirmá que da el mensaje claro en español, no un timeout.
- [ ] **Decidir si querés probar un lote real de 80 facturas** (T022) — no lo disparé porque cuesta dinero real contra el proveedor de extracción (Claude). Si querés esa confirmación, avisame y lo hacemos juntos.

## Para usar el respaldo de verdad en producción (US5 — el código ya está probado)

El pipeline completo (empaquetar, cifrar con `age`, subir con `rclone`, escribir el estado, restaurar en un servidor limpio, rechazar sobrescribir sin `--forzar`) ya se probó de punta a punta con Docker real — instalé `age`/`rclone` localmente y usé un directorio local como "remoto" para no depender de una cuenta en la nube. Lo que falta es solo conectar tus credenciales reales:

- [ ] **Crear una cuenta en un proveedor de almacenamiento de objetos** (p. ej. Backblaze B2) y correr `rclone config` para armar el remoto — lo necesito para `MYIVO_BACKUP_REMOTE`. No puedo crear cuentas de terceros por mi cuenta.
- [ ] **Generar tu llave `age` real** (`age-keygen -o llave.txt`, un comando) y guardarla en tu gestor de contraseñas, fuera del servidor — es `MYIVO_BACKUP_ENCRYPTION_KEY` (FR-018a: nunca solo en el servidor que se respalda). La que usé para probar era una llave descartable de prueba, no sirve para producción.
- [ ] **Correr el simulacro de restauración una vez más, ya con tus credenciales reales**, contra un VPS/entorno desechable de verdad — lo que probé localmente confirma que el mecanismo funciona, pero FR-020 pide esa confirmación con la infraestructura real antes de confiar en ella si el VPS se pierde de verdad.

## Qué falta del feature en general (yo lo sigo)

Nada — **Polish** (T044-T046) ya cerrado: README con `age`/`rclone` documentados, `typecheck`/`lint` limpios en todo el monorepo, y `quickstart.md` corrido completo contra el stack local (postgres+api+caddy). Las 46 tareas están en `[X]` salvo las bloqueadas en tu acción de arriba. Lo único que me falta a mí es re-confirmar T046 (SC-001) una vez haya un VPS real — mismo bloqueo que T011.

US7 (índices de escala) se probó con 5000 facturas sintéticas de prueba — de paso encontró que la búsqueda difusa de duplicados no estaba usando el índice nuevo (`similarity()` como función no es index-aware, hacía falta el operador `%`); ya corregido en `duplicate-matching.service.ts`. US8 (salud + secretos) probó en vivo que `/health` sobrevive a Postgres caída, y una auditoría empírica (no solo lectura de código) confirmó que ningún error de conexión real filtra la contraseña de la base de datos.

## De sesiones anteriores, todavía sin resolver (no es parte de este spec, pero quedó anotado)

- [ ] Backup de imágenes — lo resuelve US5 de esta misma feature, ya no es un gap aparte.
- [ ] Sentry / UptimeRobot / GitGuardian — pendiente de que crees esas cuentas.
- [ ] Prueba de punta a punta de passkeys/2FA en la app real.
