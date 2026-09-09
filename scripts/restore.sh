#!/usr/bin/env bash
# Restauración de un respaldo cifrado (specs/007-despliegue-produccion, US5,
# FR-020) — el reverso exacto de scripts/backup-db.sh. Pensado para correr
# contra un servidor limpio: `docker compose up -d postgres` (sin `api`
# todavía — así `prisma migrate deploy` no compite por crear el esquema
# antes de que este script restaure el dump completo, que ya trae su propio
# esquema y su propia tabla `_prisma_migrations`).
#
# Uso:
#   ./scripts/restore.sh <archivo-en-backups/-o-nombre-en-el-remoto> [--forzar]
#
# Si el archivo no existe localmente en backups/, se descarga primero desde
# MYIVO_BACKUP_REMOTE. `--forzar` es obligatorio si la base de datos destino
# ya tiene datos — por defecto este script nunca sobrescribe algo existente
# (constitution Principio I).
set -euo pipefail

DIR_PROYECTO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR_PROYECTO"

set -a
[ -f .env ] && source .env
set +a

DIR_BACKUPS="${MYIVO_BACKUP_DIR:-$DIR_PROYECTO/backups}"
RUTA_IMAGENES="${IMAGE_STORAGE_PATH:-/data/invoices}"

ARCHIVO_ARG=""
FORZAR=""
for arg in "$@"; do
  case "$arg" in
    --forzar) FORZAR="1" ;;
    *) ARCHIVO_ARG="$arg" ;;
  esac
done

if [ -z "$ARCHIVO_ARG" ]; then
  echo "Uso: $0 <archivo-en-backups/-o-nombre-en-el-remoto> [--forzar]" >&2
  exit 2
fi

if [ -z "${MYIVO_BACKUP_ENCRYPTION_KEY:-}" ]; then
  echo "ERROR: falta MYIVO_BACKUP_ENCRYPTION_KEY en el .env de la raíz — sin ella no se puede descifrar nada." >&2
  exit 2
fi

# Resuelve el archivo: local tal cual, local dentro de backups/, o lo baja del remoto.
if [ -f "$ARCHIVO_ARG" ]; then
  ARCHIVO_CIFRADO="$ARCHIVO_ARG"
elif [ -f "$DIR_BACKUPS/$ARCHIVO_ARG" ]; then
  ARCHIVO_CIFRADO="$DIR_BACKUPS/$ARCHIVO_ARG"
else
  if [ -z "${MYIVO_BACKUP_REMOTE:-}" ]; then
    echo "ERROR: '$ARCHIVO_ARG' no existe localmente y falta MYIVO_BACKUP_REMOTE para buscarlo en el remoto." >&2
    exit 2
  fi
  echo "No está localmente — descargando desde $MYIVO_BACKUP_REMOTE ..."
  mkdir -p "$DIR_BACKUPS"
  rclone copy "$MYIVO_BACKUP_REMOTE/$ARCHIVO_ARG" "$DIR_BACKUPS/"
  ARCHIVO_CIFRADO="$DIR_BACKUPS/$ARCHIVO_ARG"
fi

if [ ! -f "$ARCHIVO_CIFRADO" ]; then
  echo "ERROR: no se pudo resolver el archivo '$ARCHIVO_ARG'." >&2
  exit 2
fi

# Precondición de seguridad (constitution Principio I): nunca pisar datos
# existentes sin confirmación explícita. Si la tabla no existe todavía (o la
# consulta falla por cualquier motivo), se asume un servidor limpio.
CONTEO_EXISTENTE="$(docker compose exec -T postgres psql -U "${POSTGRES_USER:-myivo}" -d "${POSTGRES_DB:-myivo}" -tAc 'SELECT COUNT(*) FROM facturas' 2>/dev/null || echo 0)"
CONTEO_EXISTENTE="$(echo "$CONTEO_EXISTENTE" | tr -d '[:space:]')"
if [ "${CONTEO_EXISTENTE:-0}" != "0" ] && [ -z "$FORZAR" ]; then
  echo "ERROR: la base de datos destino ya tiene $CONTEO_EXISTENTE factura(s) — usa --forzar si de verdad querés sobrescribir." >&2
  exit 1
fi

TMPDIR_RESTORE="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_RESTORE"' EXIT

echo "$MYIVO_BACKUP_ENCRYPTION_KEY" >"$TMPDIR_RESTORE/identidad.txt"
chmod 600 "$TMPDIR_RESTORE/identidad.txt"

age -d -i "$TMPDIR_RESTORE/identidad.txt" -o "$TMPDIR_RESTORE/combinado.tar" "$ARCHIVO_CIFRADO"
tar -xf "$TMPDIR_RESTORE/combinado.tar" -C "$TMPDIR_RESTORE"

# 1) Base de datos — el dump ya trae su propio esquema y su propia tabla
# _prisma_migrations, por eso este script exige un Postgres sin esquema
# todavía (ver comentario del encabezado).
gunzip -c "$TMPDIR_RESTORE/db.sql.gz" | docker compose exec -T postgres psql -U "${POSTGRES_USER:-myivo}" -d "${POSTGRES_DB:-myivo}"

# 2) Imágenes — mismo volumen que monta el servicio `api` en docker-compose.yml,
# sin arrancar `api` de verdad (--entrypoint sh evita disparar
# `prisma migrate deploy` mientras el paso 1 todavía no terminó de aplicar).
docker compose run --rm -T --no-deps --entrypoint sh api -c "tar xzf - -C '$RUTA_IMAGENES'" <"$TMPDIR_RESTORE/imagenes.tar.gz"

CONTEO_RESTAURADO="$(docker compose exec -T postgres psql -U "${POSTGRES_USER:-myivo}" -d "${POSTGRES_DB:-myivo}" -tAc 'SELECT COUNT(*) FROM facturas' | tr -d '[:space:]')"

echo "Restauración completa: $CONTEO_RESTAURADO factura(s) restauradas desde $ARCHIVO_CIFRADO."
echo "Ahora podés levantar el resto del sistema: docker compose up -d --build"
