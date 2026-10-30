# Quickstart: Despliegue en Producción

Esta es la guía que SC-001 exige que exista ("siguiendo el procedimiento documentado") y la que ejecuta la Independent Test de cada historia de usuario. No repite el detalle ya escrito en `contracts/`/`data-model.md` — los referencia.

## Prerrequisitos

- Un VPS Linux nuevo con Docker + Docker Compose Plugin instalados — **ver § 0 abajo si todavía no tenés ninguno** (decisión tomada: DigitalOcean, 1 vCPU/2GB, ~$12/mes).
- Un dominio propio con su registro DNS (A/AAAA) ya apuntando a la IP del VPS — **ver § 0.2** si todavía no tenés dominio.
- **`age` y `rclone` instalados en el VPS mismo** (`scripts/backup-db.sh`/`scripts/restore.sh` corren ahí directamente, no dentro de un contenedor — README.md § Stack): en Debian/Ubuntu, `apt install age` (o el binario desde [age-encryption.org](https://age-encryption.org/)) y `curl https://rclone.org/install.sh | sudo bash`.
- Una cuenta en un proveedor de almacenamiento de objetos compatible con S3 (decisión tomada: Backblaze B2, 10GB gratis) con un bucket creado y credenciales generadas — **ver § 0.3**. Con esas credenciales, correr `rclone config` **en el VPS** para armar el remoto — su nombre (p. ej. `b2prod:mi-bucket/produccion`) es el valor de `MYIVO_BACKUP_REMOTE` — **ver § 0.4**.
- Una cuenta de Resend con `RESEND_API_KEY` (ya requerido desde `specs/006-multi-usuario`, sin cambios).
- Generado localmente: una llave `age` (`age-keygen`) para `MYIVO_BACKUP_ENCRYPTION_KEY`, y guardada aparte, fuera del VPS, en tu gestor de contraseñas (FR-018a — este paso es manual a propósito, ver contracts/env-vars.md). Es la MISMA llave que va en el `.env` del VPS — `age-keygen` corre una sola vez (en tu máquina o en el VPS, da igual), no una vez por lugar. Paso a paso ya cubierto en `specs/007-despliegue-produccion/PENDIENTES.md`.

## 0. Conseguir la infraestructura, desde cero

Esta sección es solo para la primera vez — si ya tenés el VPS, el dominio, y la cuenta de storage, saltá directo a "## 1. Preparar la configuración".

### 0.1 Crear el VPS en DigitalOcean

1. Entrá a [digitalocean.com](https://www.digitalocean.com) y creá una cuenta (correo + contraseña, o con tu cuenta de Google/GitHub). Te van a pedir una tarjeta o PayPal para activar la facturación — el plan que vamos a usar no es gratis.
2. Arriba a la derecha, **Create → Droplets**.
3. **Choose an image**: no elijas "Ubuntu" a secas — buscá en la pestaña **Marketplace** la imagen **"Docker on Ubuntu"**. Viene con Docker y el plugin de Compose ya instalados, te ahorra todo ese paso.
4. **Choose Size**: pestaña **Basic** → **Regular SSD** → el plan de **1 vCPU / 2GB RAM / 50GB SSD** (~$12/mes).
5. **Choose a datacenter region**: cualquiera de EE. UU. (Nueva York, Atlanta, etc.) — te va a dar mejor latencia desde Colombia que Europa o Asia.
6. **Authentication**: elegí **SSH Key** (más seguro que contraseña) en vez de Password. Si nunca generaste una, hacelo en tu propia máquina antes de seguir:

   ```bash
   ssh-keygen -t ed25519 -C "tu-correo@ejemplo.com"
   cat ~/.ssh/id_ed25519.pub
   ```

   Pegá el contenido completo de ese `cat` en el campo que te pide DigitalOcean ("New SSH Key").
7. Ponele un nombre al Droplet (p. ej. `myivo-produccion`) y creá.
8. En un minuto o dos te va a mostrar una **dirección IP pública** (p. ej. `164.90.XX.XX`) — anotala, la vas a necesitar para el DNS.
9. Conectate para confirmar que funciona:

   ```bash
   ssh root@<la-ip-que-te-dio>
   docker --version   # debería responder sin error — viene preinstalado
   ```

### 0.2 Dominio y DNS

Necesitás un dominio propio — Caddy (lo que da el HTTPS automático) no puede sacar un certificado para una IP pelada, solo para un dominio real.

1. Si no tenés uno, comprá cualquiera barato (`.com`, `.app`, etc. — unos 10-15 USD/año) en el registrador que prefieras (Namecheap, Cloudflare Registrar, el que sea).
2. En el panel de DNS de ese dominio, agregá un registro **A**: Host `@` (o un subdominio, p. ej. `facturas`), Valor = la IP del Droplet del paso anterior, TTL por defecto.
3. Esperá a que propague (puede ser desde minutos hasta un par de horas). Confirmá con:

   ```bash
   dig +short tu-dominio.com
   ```

   Debería devolver la misma IP del Droplet.

### 0.3 Backblaze B2 — cuenta, bucket y credenciales

1. Creá una cuenta gratis en [backblaze.com/cloud-storage](https://www.backblaze.com/cloud-storage) (no pide tarjeta para el tier gratis).
2. En el panel, **Buckets → Create a Bucket**. Nombre único (p. ej. `myivo-backups-tu-nombre`), tipo **Private** (nunca público — son tus facturas cifradas).
3. **Application Keys → Add a New Application Key**. Importante: NO uses la "master key" — generá una nueva, restringida a este bucket puntual. Ponele un nombre y confirmá.
4. Te va a mostrar **keyID** y **applicationKey** — la `applicationKey` solo se muestra UNA vez, copiala ya a tu gestor de contraseñas. Estas dos van directo al paso siguiente (y después al `.env` del VPS) — nunca me las pegues a mí en el chat.
5. Anotá también el **Endpoint** que te muestra el bucket (algo como `s3.us-west-002.backblazeb2.com`) — lo vas a necesitar si en algún momento configurás algo manualmente, aunque `rclone config` ya lo resuelve solo con el ID de cuenta.

### 0.4 Conectar `rclone` con Backblaze (en el VPS)

Por SSH, en el VPS (después de instalar `rclone` — ver Prerrequisitos arriba):

```bash
rclone config
```

Seguí el asistente interactivo:

- `n` → nuevo remoto.
- Nombre: `b2prod` (o el que quieras — eso es lo que después va en `MYIVO_BACKUP_REMOTE`).
- Tipo: buscá/escribí `b2` (Backblaze B2 — no "s3", `rclone` tiene soporte nativo para B2).
- `account`: pegá el **keyID** del paso 0.3.
- `key`: pegá la **applicationKey** del paso 0.3.
- El resto, dejar los valores por defecto (Enter).
- `y` para confirmar, `q` para salir.

Confirmá que funciona:

```bash
rclone lsd b2prod:
```

Debería listar tu bucket sin error. El valor de `MYIVO_BACKUP_REMOTE` en tu `.env` va a ser `b2prod:myivo-backups-tu-nombre/produccion` (el nombre de tu bucket real + una carpeta, p. ej. `produccion`).

Con esto ya tenés los 3 prerrequisitos resueltos — seguí con la llave `age` (PENDIENTES.md) y después con "## 1. Preparar la configuración" de acá abajo.

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
git clone <repo> && cd myivo
cp .env.example .env                       # editar: mismas MYIVO_BACKUP_ENCRYPTION_KEY/MYIVO_BACKUP_REMOTE que en producción
cp apps/api/.env.example apps/api/.env      # con los valores de ejemplo alcanza — restore.sh no los usa, pero docker-compose.yml exige que el archivo exista
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
