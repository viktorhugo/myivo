#!/usr/bin/env bash
# Backup diario de PostgreSQL + imágenes de facturas — cifrado con `age` y
# subido fuera del servidor con `rclone` (specs/007-despliegue-produccion,
# US5, FR-017/FR-018/FR-018a/FR-019/FR-021). Pensado para correr vía cron en
# el VPS. No requiere pg_dump en el host: usa el propio contenedor de
# docker-compose.yml (misma versión de Postgres que la que corre en
# producción), igual que cualquier otra operación de ese compose.
#
# Cron sugerido (todos los días a las 3:00 a.m., hora del servidor):
#   0 3 * * * cd /ruta/al/proyecto && ./scripts/backup-db.sh >> /var/log/myivo-backup.log 2>&1
#
# Requiere en el .env de la raíz: MYIVO_BACKUP_ENCRYPTION_KEY (una llave de
# `age`, ver .env.example) y MYIVO_BACKUP_REMOTE (un remoto de `rclone` ya
# configurado). Sin ambas, el script falla antes de generar cualquier
# archivo — nunca deja un respaldo sin cifrar como único resultado.
set -euo pipefail

DIR_PROYECTO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR_PROYECTO"

# Mismas variables que ya usa docker-compose.yml para el servicio postgres,
# más las de respaldo de abajo.
set -a
[ -f .env ] && source .env
set +a

DIR_BACKUPS="${MYIVO_BACKUP_DIR:-$DIR_PROYECTO/backups}"
DIAS_RETENCION="${MYIVO_BACKUP_RETENCION_DIAS:-14}"
FECHA="$(date +%Y%m%d-%H%M%S)"
ARCHIVO_ESTADO="$DIR_BACKUPS/ultimo-estado.json"
ARCHIVO_FINAL="$DIR_BACKUPS/myivo-${FECHA}.tar.age"

mkdir -p "$DIR_BACKUPS"

MENSAJE_ERROR=""
TMPDIR_BACKUP=""

# FR-021: el resultado de cada corrida (éxito o fallo) queda en un archivo
# plano en disco, no en la base de datos que se está respaldando — preguntar
# "¿mi respaldo funcionó?" no debería depender de esa misma BD estando sana
# (research.md § 13). `GET /health` lo lee de acá.
escribir_estado() {
  local resultado="$1"
  local fecha_iso
  fecha_iso="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  if [ -n "$MENSAJE_ERROR" ]; then
    printf '{"fecha":"%s","resultado":"%s","mensaje":"%s"}\n' "$fecha_iso" "$resultado" "$MENSAJE_ERROR" >"$ARCHIVO_ESTADO"
  else
    printf '{"fecha":"%s","resultado":"%s"}\n' "$fecha_iso" "$resultado" >"$ARCHIVO_ESTADO"
  fi
}

al_salir() {
  local codigo=$?
  [ -n "$TMPDIR_BACKUP" ] && rm -rf "$TMPDIR_BACKUP"
  if [ "$codigo" -ne 0 ]; then
    escribir_estado "fallido"
  fi
}
trap al_salir EXIT

if [ -z "${MYIVO_BACKUP_ENCRYPTION_KEY:-}" ]; then
  MENSAJE_ERROR="falta MYIVO_BACKUP_ENCRYPTION_KEY en el .env de la raíz"
  echo "ERROR: $MENSAJE_ERROR" >&2
  exit 1
fi
if [ -z "${MYIVO_BACKUP_REMOTE:-}" ]; then
  MENSAJE_ERROR="falta MYIVO_BACKUP_REMOTE en el .env de la raíz"
  echo "ERROR: $MENSAJE_ERROR" >&2
  exit 1
fi

TMPDIR_BACKUP="$(mktemp -d)"

# 1) Dump de la base de datos.
docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-myivo}" "${POSTGRES_DB:-myivo}" | gzip >"$TMPDIR_BACKUP/db.sql.gz"
if [ ! -s "$TMPDIR_BACKUP/db.sql.gz" ]; then
  MENSAJE_ERROR="el dump de la base de datos quedó vacío"
  echo "ERROR: $MENSAJE_ERROR — revisa que el contenedor postgres esté corriendo." >&2
  exit 1
fi

# 2) Imágenes originales — el mismo volumen que monta el contenedor `api` en
# IMAGE_STORAGE_PATH (docker-compose.yml).
docker compose exec -T api tar -czf - -C "${IMAGE_STORAGE_PATH:-/data/invoices}" . >"$TMPDIR_BACKUP/imagenes.tar.gz"
if [ ! -s "$TMPDIR_BACKUP/imagenes.tar.gz" ]; then
  MENSAJE_ERROR="el empaquetado de imágenes quedó vacío"
  echo "ERROR: $MENSAJE_ERROR — revisa que el contenedor api esté corriendo." >&2
  exit 1
fi

# 3) Cifrado simétrico con `age` — la llave de identidad vive solo en
# memoria/tmpfs de este proceso, nunca se escribe fuera de $TMPDIR_BACKUP
# (que el trap de arriba borra siempre, éxito o fallo).
echo "$MYIVO_BACKUP_ENCRYPTION_KEY" >"$TMPDIR_BACKUP/identidad.txt"
chmod 600 "$TMPDIR_BACKUP/identidad.txt"
tar -cf - -C "$TMPDIR_BACKUP" db.sql.gz imagenes.tar.gz |
  age -e -i "$TMPDIR_BACKUP/identidad.txt" -o "$ARCHIVO_FINAL"

if [ ! -s "$ARCHIVO_FINAL" ]; then
  MENSAJE_ERROR="el cifrado no produjo ningún archivo"
  echo "ERROR: $MENSAJE_ERROR" >&2
  exit 1
fi

# 4) Subida al destino externo — fuera del servidor, FR-018.
if ! rclone copy "$ARCHIVO_FINAL" "$MYIVO_BACKUP_REMOTE"; then
  MENSAJE_ERROR="la subida a $MYIVO_BACKUP_REMOTE falló"
  echo "ERROR: $MENSAJE_ERROR" >&2
  exit 1
fi

echo "Backup guardado y subido: $ARCHIVO_FINAL ($(du -h "$ARCHIVO_FINAL" | cut -f1)) -> $MYIVO_BACKUP_REMOTE"

# Rotación — borra respaldos locales con más de $DIAS_RETENCION días. El
# remoto tiene su propia política de retención, configurable en el
# proveedor (fuera del alcance de este script).
find "$DIR_BACKUPS" -name 'myivo-*.tar.age' -mtime "+${DIAS_RETENCION}" -delete

escribir_estado "ok"
