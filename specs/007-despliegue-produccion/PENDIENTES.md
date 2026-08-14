# Pendientes — Despliegue en Producción

Lista de lo que quedó bloqueado en algo que solo vos podés hacer (cuenta real, VPS real, decisión de costo), compilada al cierre de la sesión del 2026-08-13. El detalle completo de cada tarea, con lo que sí se verificó, está en [tasks.md](./tasks.md).

## Bloqueados en tu acción (US1-US6, ya implementadas)

- [ ] **Confirmar SC-001 en un VPS real** (T011) — todo lo demás ya se probó con Docker de verdad en local (build limpio, migraciones automáticas, fail-fast, `/health`), pero falta un VPS con dominio propio apuntando por DNS para confirmar HTTPS accesible en <15 min con Let's Encrypt real.
- [ ] **Confirmar que la sesión sobrevive a un restart con una cuenta real** (T015) — el rate limit (5 intentos → bloqueo) y el rechazo sin sesión ya se probaron en vivo. Falta solo: registrar una cuenta de verdad (con correo verificado), reiniciar el contenedor `api`, y confirmar que seguís logueado.
- [ ] **Probar el límite de tamaño de archivo con una sesión real** (T022) — `SessionUsuarioGuard` corre antes que Multer, así que no pude ejercer el límite de 20MB/archivo sin loguearme. Con una cuenta real: subí un archivo de más de 20MB y confirmá que da el mensaje claro en español, no un timeout.
- [ ] **Decidir si querés probar un lote real de 80 facturas** (T022) — no lo disparé porque cuesta dinero real contra el proveedor de extracción (Claude). Si querés esa confirmación, avisame y lo hacemos juntos.

## Para arrancar la siguiente historia (US5 — respaldo cifrado)

- [ ] **Crear una cuenta en un proveedor de almacenamiento de objetos** (p. ej. Backblaze B2) y generar credenciales — lo necesito para `MYIVO_BACKUP_REMOTE` (`rclone`). No puedo crear cuentas de terceros por mi cuenta.
- [ ] **Generar una llave `age`** (`age-keygen`, un comando) y guardarla en tu gestor de contraseñas, fuera del servidor — es `MYIVO_BACKUP_ENCRYPTION_KEY` (FR-018a: nunca solo en el servidor que se respalda).

## Qué falta del feature en general (yo lo sigo mañana)

20 de 46 tareas — US5 (respaldo/restauración, 7), US7 (índices de escala, 3), US8 (salud + auditoría de secretos, 3), Polish (3), más 4 tareas ya completas de fases anteriores que quedaron marcadas [ ] a propósito por depender de vos (arriba). Orden sugerido: US5 → US7 → US8 → Polish.

## De sesiones anteriores, todavía sin resolver (no es parte de este spec, pero quedó anotado)

- [ ] Backup de imágenes — lo resuelve US5 de esta misma feature, ya no es un gap aparte.
- [ ] Sentry / UptimeRobot / GitGuardian — pendiente de que crees esas cuentas.
- [ ] Prueba de punta a punta de passkeys/2FA en la app real.
