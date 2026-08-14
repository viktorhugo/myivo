# Quickstart: Despliegue en Producción

Esta es la guía que SC-001 exige que exista ("siguiendo el procedimiento documentado") y la que ejecuta la Independent Test de cada historia de usuario. No repite el detalle ya escrito en `contracts/`/`data-model.md` — los referencia.

## Prerrequisitos

- Un VPS Linux nuevo con Docker + Docker Compose Plugin instalados (el propio proveedor del VPS suele tener una imagen base con esto ya listo).
- Un dominio propio con su registro DNS (A/AAAA) ya apuntando a la IP del VPS — fuera de alcance de esta feature (spec § Assumptions), se asume ya resuelto.
- Una cuenta en un proveedor de almacenamiento de objetos compatible con S3 (p. ej. Backblaze B2) con un bucket creado y credenciales generadas — la crea el usuario, esta feature no puede hacerlo por su cuenta (research.md § 12).
- Una cuenta de Resend con `RESEND_API_KEY` (ya requerido desde `specs/006-multi-usuario`, sin cambios).
- Generado localmente: una llave `age` (`age-keygen`) para `MYIVO_BACKUP_ENCRYPTION_KEY`, y guardada aparte, fuera del VPS, en tu gestor de contraseñas (FR-018a — este paso es manual a propósito, ver contracts/env-vars.md).

## 1. Preparar la configuración

```bash
git clone <repo> && cd myivo
cp .env.example .env                       # raíz — Postgres, Caddy, respaldo (contracts/env-vars.md)
cp apps/api/.env.example apps/api/.env      # API — Better Auth, extracción, límites (contracts/env-vars.md)
```

Editar ambos `.env` con los valores reales — en particular, los que `contracts/env-vars.md` marca como "deben cambiar en producción": `NODE_ENV=production`, `BETTER_AUTH_URL`/`WEB_ORIGIN` al dominio real (`https://...`), `APP_DOMAIN`/`CADDY_ACME_EMAIL`, `MYIVO_BACKUP_ENCRYPTION_KEY`/`MYIVO_BACKUP_REMOTE`.

## 2. Levantar el sistema (US1)

```bash
docker compose up -d --build
```

**Verificación (US1 Independent Test / SC-001)**: desde un navegador o `curl https://<tu-dominio>/health` — debe responder `{"status":"ok","baseDeDatos":"ok",...}` (contracts/health.md) en menos de 15 minutos desde que el VPS estaba limpio. `curl http://<ip-del-vps>:5432` (o cualquier intento de conexión externa a Postgres) MUST fallar — la base de datos nunca se expone (FR-004, ya así en `docker-compose.yml`).

Redesplegar una versión con cambios de esquema (`git pull && docker compose up -d --build`) MUST aplicar las migraciones solo (FR-002, contracts sección "Migraciones") sin ningún paso manual adicional.

## 3. Verificar sesión y login (US2)

1. Registrarse/iniciar sesión desde `https://<tu-dominio>`.
2. `docker compose restart api` (simula un redespliegue).
3. Recargar la app — MUST seguir autenticado, sin volver a pedir credenciales (research.md § 2).
4. Sin sesión, `curl https://<tu-dominio>/api/invoices/<id>/image` MUST responder 401/403 — nunca servir la imagen de forma anónima (FR-009).
5. Intentar iniciar sesión 6 veces seguidas con una contraseña incorrecta — el intento debe quedar bloqueado temporalmente (research.md § 3, FR-008).

## 4. Lote grande (US3)

Subir 80 archivos de una sola vez desde la pantalla de Captura. **Verificación**: los 80 terminan en un estado final del pipeline (`extraída`, `necesita_revisión` o `fallida` — nunca indefinidamente en `procesando` por saturación propia); la pantalla de Captura muestra el conteo de procesados/pendientes en vivo (FR-014, ya cubierto por la UI existente — research.md § 6); en los logs del contenedor `api`, las extracciones se disparan en grupos acotados, no las 80 de golpe (`EXTRACTION_MAX_CONCURRENCY`, contracts/env-vars.md).

Subir un archivo por encima de `UPLOAD_MAX_FILE_SIZE_MB` MUST devolver un mensaje claro de límite excedido, no un timeout ni un 500.

## 5. Recuperación al arranque (US4)

```bash
# Sube una factura, y mientras diga "procesando" en la UI:
docker compose kill api
docker compose up -d api
```

**Verificación**: la factura que quedó en `procesando` pasa a `fallida` (reintentable desde la UI) apenas la API vuelve a arrancar — nunca queda atascada. `docker compose logs api | grep RecuperacionArranque` MUST mostrar la entrada estructurada descrita en `data-model.md` § Evento de recuperación al arranque.

## 6. Respaldo y restauración (US5) — la prueba más importante

```bash
./scripts/backup-db.sh
```

**Verificación del respaldo**: exit code `0`; el archivo `.tar.age` aparece tanto en `backups/` como en el bucket remoto (revisar desde la consola del proveedor o `rclone ls "$MYIVO_BACKUP_REMOTE"`); `curl https://<tu-dominio>/health` refleja `ultimoRespaldo.resultado: "ok"` (contracts/health.md).

**Simulacro de restauración (FR-020 — MUST ejecutarse al menos una vez, no es opcional)**: hacerlo primero contra un entorno desechable, nunca directo sobre producción real la primera vez:

```bash
# En un VPS/entorno Docker limpio y separado del de producción:
git clone <repo> && cd myivo && cp .env.example .env   # mismas credenciales de respaldo (misma MYIVO_BACKUP_ENCRYPTION_KEY)
docker compose up -d postgres
./scripts/restore.sh myivo-<timestamp>.tar.age
```

**Verificación**: exit code `0`; el conteo de facturas restauradas que imprime el script coincide con el de origen; abrir un par de facturas al azar en la UI del entorno restaurado y confirmar que la imagen original carga igual que en producción (SC-005). Solo después de que este simulacro haya pasado una vez, FR-020 se considera cumplido — y recién ahí es razonable confiar en restaurar sobre producción real si el VPS original se pierde de verdad.

Revisar también: varios días de respaldos acumulados en `backups/` y en el remoto (FR-019); intentar `restore.sh` sin `--forzar` contra un Postgres que ya tiene datos MUST rechazarse (contracts/backup-restore.md).

## 7. Montos altos (US6)

Corregir manualmente el total de una factura a un valor por encima de $21.474.836 COP (p. ej. $50.000.000). **Verificación**: se guarda sin error; aparece correcto en el Listado y en el Reporte Anual (suma exacta, sin truncar) — confirma la migración `Int`→`BigInt` (data-model.md § 1).

## 8. Volumen (US7) — verificación aproximada, no exhaustiva

Con una cuenta que acumule un historial grande (o datos de prueba insertados directamente), medir el tiempo de respuesta de `GET /invoices` filtrado y de la detección de duplicados. **Verificación**: sin degradación notoria perceptible — confirma que los índices de `data-model.md` § 2 están aplicados (`\d facturas` en `psql` MUST listar los 3 índices nuevos).

## 9. Salud del sistema (US8)

`curl https://<tu-dominio>/health` con Postgres apagado (`docker compose stop postgres`) MUST responder igual `status: "ok"` (el proceso Node sigue vivo) pero `baseDeDatos: "error"` — confirma que el chequeo es real, no un valor fijo (contracts/health.md). Recordar volver a levantar Postgres después de esta prueba.
