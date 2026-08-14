#!/usr/bin/env sh
# Arranque del contenedor `api` en producción (FR-002): aplica cualquier
# migración de Prisma pendiente ANTES de servir tráfico, sin que el usuario
# corra nada a mano. Seguro de correr en cada despliegue — `migrate deploy`
# no hace nada si no hay migraciones nuevas.
set -e

cd "$(dirname "$0")"
pnpm exec prisma migrate deploy

exec node dist/main.js
