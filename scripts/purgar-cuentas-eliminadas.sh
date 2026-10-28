#!/usr/bin/env bash
# Purga diaria de cuentas con eliminación programada vencida —
# specs/008-borrado-cuenta (US3), constitution Principio I v2.1.0 (única
# excepción al soft-delete puro: borrado de cuenta iniciado por su propio
# titular, con ventana de 30 días ya vencida sin reversión). Mismo patrón
# que scripts/backup-db.sh: cron del sistema operativo + script, sin
# scheduler en proceso dentro de la API.
#
# Cron sugerido (todos los días a las 4:00 a.m., hora del servidor — después
# del backup de las 3:00 a.m., para respaldar antes de purgar):
#   0 4 * * * cd /ruta/al/proyecto && ./scripts/purgar-cuentas-eliminadas.sh >> /var/log/myivo-purga.log 2>&1
#
# La lógica real vive en apps/api/src/modules/purga-cuentas/purga-cuentas.service.ts
# (reutiliza FileStorageService/Prisma/aislarPorUsuario vía el contexto de
# Nest) — este script solo invoca el comando dentro del contenedor `api`,
# igual que backup-db.sh hace con pg_dump/tar dentro de sus contenedores.
set -euo pipefail

DIR_PROYECTO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR_PROYECTO"

docker compose exec -T api pnpm --filter @myivo/api purgar:cuentas-eliminadas
