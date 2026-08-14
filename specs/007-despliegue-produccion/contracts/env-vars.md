# Contrato: Variables de entorno

La superficie de configuración ES la interfaz principal de una feature de despliegue (FR-005: el sistema MUST negarse a arrancar si falta o es inválida alguna configuración obligatoria). Todo lo de abajo se valida al arranque — lo nuevo de esta feature se agrega a `apps/api/src/config/env.schema.ts` (Zod, ya falla rápido y con mensaje claro — patrón existente, no se cambia) salvo lo que corresponde al `.env` de la raíz (leído por `docker-compose.yml`/`scripts/backup-db.sh`, fuera del proceso Nest).

## `apps/api/.env` — nuevas, validadas por `env.schema.ts`

| Variable | Tipo | Default | Requisito que satisface |
|---|---|---|---|
| `UPLOAD_MAX_FILE_SIZE_MB` | entero positivo | `20` | FR-012 — límite de tamaño por archivo subido. |
| `UPLOAD_MAX_FILES_PER_BATCH` | entero positivo | `100` | FR-013 — límite de cantidad por lote (cómodo por encima del escenario de 80 de US3). |
| `EXTRACTION_MAX_CONCURRENCY` | entero positivo | `3` | FR-011 — extracciones simultáneas máximas (research.md § 4). |

Sigue el mismo estilo que las variables ya existentes (`extractionProviderSchema`, límites con `z.coerce.number().int().positive()`), configurable sin cambiar código (spec Assumptions).

## `apps/api/.env` — existentes, cuyo VALOR debe cambiar en producción (no son nuevas, pero esta feature depende de que dejen de ser el default de desarrollo)

| Variable | Valor en dev | Valor requerido en producción |
|---|---|---|
| `NODE_ENV` | `development` | `production` — activa el rate limiter de Better Auth (research.md § 3); sin esto, FR-008 no se cumple. |
| `BETTER_AUTH_URL` | `http://localhost:3000` | `https://<dominio-real>` — de esto depende que la cookie de sesión salga `Secure` (research.md § 2). |
| `WEB_ORIGIN` | `http://localhost:5173` | `https://<dominio-real>` — si no coincide con el origen real, Better Auth rechaza todo por CSRF. |

## `.env` (raíz del repo) — leído por `docker-compose.yml` y `scripts/backup-db.sh`

| Variable | Tipo | Default | Requisito que satisface |
|---|---|---|---|
| `APP_DOMAIN` | dominio | *(ya existe, hoy `localhost`)* | Caddy — dominio público real. |
| `CADDY_ACME_EMAIL` | email | *(ya existe)* | Caddy — contacto para el certificado TLS. |
| `MYIVO_BACKUP_RETENCION_DIAS` | entero | `14` *(ya existe)* | FR-019 — sin cambio, se reutiliza. |
| `MYIVO_BACKUP_ENCRYPTION_KEY` | string (llave `age`) | — (obligatoria para que el respaldo salga cifrado) | FR-018/FR-018a. **MUST** también guardarse manualmente en el gestor de contraseñas del usuario (paso del quickstart, no automatizable) — nunca vive solo aquí. |
| `MYIVO_BACKUP_REMOTE` | string (remoto `rclone`, p. ej. `b2:myivo-backups/produccion`) | — (obligatoria) | FR-018 — destino externo del respaldo cifrado. |

`MYIVO_BACKUP_ENCRYPTION_KEY`/`MYIVO_BACKUP_REMOTE` sin valor: el script de respaldo MUST fallar de inmediato con un mensaje claro (mismo patrón que ya usa para un dump vacío), nunca completar "a medias" subiendo un archivo sin cifrar.

## Reglas

- Ninguna variable de esta tabla se versiona (`.env` ya está en `.gitignore`; `.env.example` se actualiza con los nombres y un valor de ejemplo, nunca un secreto real — mismo patrón ya usado en todo el `.env.example` existente).
- `FR-005`: agregar estas variables a `baseEnvSchema`/`superRefine` en `env.schema.ts` para que falten con el mismo error claro que ya producen `BETTER_AUTH_SECRET`/`RESEND_API_KEY` hoy — no una ruta de validación aparte.
- `FR-028`: ningún log ni respuesta de error MUST incluir el valor de `MYIVO_BACKUP_ENCRYPTION_KEY` ni de ninguna variable existente marcada como secreto (`*_SECRET`, `*_API_KEY`, `*_CLIENT_SECRET`, `DATABASE_URL`).
