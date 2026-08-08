#!/usr/bin/env bash
# Backup diario de PostgreSQL — pg_dump comprimido + rotación local, pensado
# para correr vía cron en el VPS. No requiere pg_dump en el host: usa el
# propio contenedor de docker-compose.yml (misma versión de Postgres que la
# que corre en producción), igual que cualquier otra operación de ese compose.
#
# Cron sugerido (todos los días a las 3:00 a.m., hora del servidor):
#   0 3 * * * cd /ruta/al/proyecto && ./scripts/backup-db.sh >> /var/log/myivo-backup.log 2>&1
#
# Limitación conocida: el backup queda en el mismo VPS que la base de datos
# — protege contra "borré algo por error" o "una migración salió mal", pero
# no contra que el disco del VPS se dañe entero. Copiarlo también a otro
# lugar (otro proveedor de almacenamiento, con su propia cuenta/credenciales)
# es el siguiente paso natural, deliberadamente fuera de este script.
set -euo pipefail

DIR_PROYECTO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR_PROYECTO"

# Mismas variables que ya usa docker-compose.yml para el servicio postgres.
set -a
[ -f .env ] && source .env
set +a

DIR_BACKUPS="${MYIVO_BACKUP_DIR:-$DIR_PROYECTO/backups}"
DIAS_RETENCION="${MYIVO_BACKUP_RETENCION_DIAS:-14}"
FECHA="$(date +%Y%m%d-%H%M%S)"
ARCHIVO="$DIR_BACKUPS/myivo-${FECHA}.sql.gz"

mkdir -p "$DIR_BACKUPS"

docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-myivo}" "${POSTGRES_DB:-myivo}" | gzip > "$ARCHIVO"

# Falla ruidosamente si el dump quedó vacío (contenedor caído, credenciales
# mal, etc.) — mejor un cron que avisa (cron manda por correo cualquier
# salida a stderr por default) que un backup silenciosamente inútil.
if [ ! -s "$ARCHIVO" ]; then
  echo "ERROR: el backup quedó vacío ($ARCHIVO) — revisa que el contenedor postgres esté corriendo." >&2
  rm -f "$ARCHIVO"
  exit 1
fi

echo "Backup guardado: $ARCHIVO ($(du -h "$ARCHIVO" | cut -f1))"

# Rotación — borra backups locales con más de $DIAS_RETENCION días.
find "$DIR_BACKUPS" -name 'myivo-*.sql.gz' -mtime "+${DIAS_RETENCION}" -delete
