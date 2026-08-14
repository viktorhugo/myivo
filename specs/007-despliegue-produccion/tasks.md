---

description: "Task list template for feature implementation"
---

# Tasks: Despliegue en Producción

**Input**: Design documents from `/specs/007-despliegue-produccion/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Esta feature no agrega reglas de dominio nuevas (Constitution Check de plan.md) — no se generan tareas de test unitario nuevas por defecto (regla de `/speckit-tasks`: tests son opcionales salvo pedido explícito, y ninguno de spec.md lo pide). Sí se incluye, dentro de cada historia, una tarea de **validación** que ejecuta la sección correspondiente de `quickstart.md` (el Independent Test de esa historia) y, en US6, una tarea explícita de **re-correr los tests existentes** de `packages/domain`/`apps/api` para confirmar que la migración `Int→BigInt` no rompió nada — no son tests nuevos, son la red de seguridad ya existente.

**Organization**: Tareas agrupadas por historia de usuario, en el mismo orden de prioridad de `spec.md` (P1 → P2 → P3), para que cada una sea implementable, validable y entregable de forma independiente — mismo acuerdo de entrega incremental ya usado en features anteriores de este repo.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencia de una tarea sin terminar)
- **[Story]**: A qué historia de usuario pertenece (US1... US8)
- Cada tarea incluye la ruta de archivo exacta

## Convención de rutas (monorepo real, no genérico)

```text
Dockerfile.api, Dockerfile.web, docker-compose.yml, Caddyfile, .dockerignore   # raíz del repo
scripts/backup-db.sh, scripts/restore.sh                                       # raíz del repo
apps/api/src/...                                                               # backend NestJS
apps/api/prisma/schema.prisma, apps/api/prisma/migrations/...                  # esquema/migraciones
apps/web/src/...                                                               # frontend React (sin cambios de negocio en esta feature)
```

---

## Phase 1: Setup

**Purpose**: Preparación mínima compartida — este repo ya existe y ya corre; no hace falta inicializar nada de cero.

- [X] T001 [P] Crear `.dockerignore` en la raíz del repo (`node_modules/`, `dist/`, `.git/`, `.env*`, `backups/`, `apps/*/data/`, `coverage/`) — usado por `Dockerfile.api`/`Dockerfile.web` de la Fase 2.
- [X] ~~T002 [P] Agregar `p-limit` como dependencia directa~~ — revertido en la Fase 7 (T033): `p-limit@7` es ESM-only y rompe bajo Jest (`import()` dinámico sin `--experimental-vm-modules`). US3 usa en su lugar un limitador de concurrencia propio sin dependencias (`apps/api/src/modules/extraction/limitador-concurrencia.ts`) — ver T020.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Las recetas de build que el resto de la infraestructura de despliegue (US1) necesita para poder wireearlas en `docker-compose.yml`. No hay ningún modelo/servicio de dominio compartido que bloquee al resto de las historias — este feature no agrega ninguno (Constitution Check, plan.md); el resto de las historias (US2-US8) se puede implementar en paralelo tras esta fase sin depender entre sí a nivel de código, aunque su *validación* real (quickstart.md) sí asume que US1 ya está desplegado (ver Dependencias más abajo).

**⚠️ CRITICAL**: No se puede completar US1 sin esto.

- [X] T003 [P] Crear `Dockerfile.api` — build multi-stage sobre `node:22-bookworm-slim` (deps → `prisma generate` → `pnpm --filter @myivo/api build` → runtime con `node dist/main.js`), research.md § 10.
- [X] T004 [P] Crear `Dockerfile.web` — build multi-stage sobre `node:22-bookworm-slim` (`vite build` → stage final que solo contiene `dist/` para copiarse a `/srv/web`), research.md § 10.

**Checkpoint**: Ambas imágenes construyen localmente (`docker build -f Dockerfile.api .` / `docker build -f Dockerfile.web .`) antes de wirearlas en compose.

---

## Phase 3: User Story 1 - Levantar el sistema completo con un comando (Priority: P1) 🎯 MVP

**Goal**: `docker compose up` en un VPS limpio deja todo el sistema (BD, API, web, HTTPS) funcionando, sin la base de datos expuesta, con migraciones automáticas, y fallando rápido ante configuración inválida.

**Independent Test**: aprovisionar un VPS limpio, seguir el procedimiento documentado (quickstart.md § 1-2), confirmar HTTPS accesible en <15 min, BD inaccesible desde fuera, cero pasos manuales no documentados.

### Implementation for User Story 1

- [X] T005 [P] [US1] Corregir `Caddyfile`: `handle /api/*` → `handle_path /api/*` (hoy no quita el prefijo `/api` antes de reenviar a `api:3000`, y ningún controller de NestJS está montado bajo ese prefijo — research.md § 1). Agregar también los volúmenes `caddy_data`/`caddy_config` en `docker-compose.yml` para que el certificado TLS sobreviva a un `docker compose down`/redespliegue.
- [X] T006 [US1] Agregar los servicios `api`, `web` (o su equivalente build-only) y `caddy` a `docker-compose.yml`: construir desde `Dockerfile.api`/`Dockerfile.web` (T003/T004), montar el volumen `invoice_images` (ya declarado, sin usar) en `api` en la ruta de `IMAGE_STORAGE_PATH`, copiar el resultado del build de `web` a donde `caddy` sirve `/srv/web`.
- [X] T007 [US1] Agregar `prisma migrate deploy` al arranque del contenedor `api` (entrypoint o encadenado en el `CMD` de `Dockerfile.api`, T003) — antes de que `node dist/main.js` empiece a servir tráfico (FR-002). Verificado con `docker compose up`: "10 migrations found... No pending migrations to apply." y `/health` responde `{"status":"ok"}`.
- [X] T008 [US1] Verificar, dentro del contenedor `api` ya armado (T006/T007), que falta o un valor inválido de una variable obligatoria (p. ej. `BETTER_AUTH_SECRET` vacío) hace fallar el arranque con el mensaje claro que ya produce `validateEnv()` en `apps/api/src/config/env.schema.ts` — confirma FR-005 en el entorno real de Docker, no solo en local. Verificado con `docker compose run` (exit code 1, mensaje claro en el log) — encontró y corrigió 2 bugs reales en el camino, ver Notas.
- [X] T009 [P] [US1] Actualizar `.env.example` (raíz) y `apps/api/.env.example`: marcar explícitamente qué valores MUST cambiar en producción (`NODE_ENV=production`, `BETTER_AUTH_URL`, `WEB_ORIGIN`, `APP_DOMAIN`, `CADDY_ACME_EMAIL`) — contracts/env-vars.md.
- [X] T010 [P] [US1] Reescribir `README.md` § Despliegue: reemplazar el bloque "Estado actual: ... trabajo pendiente" por el procedimiento real, enlazando a `specs/007-despliegue-produccion/quickstart.md` en vez de duplicar el detalle (mismo patrón que la constitution exige para no duplicar sus propias reglas).
- [ ] T011 [US1] Ejecutar `quickstart.md` § 1-2 de punta a punta contra un VPS real (o un entorno desechable equivalente) y confirmar SC-001 (HTTPS accesible en <15 min desde un servidor limpio, BD no expuesta, cero pasos manuales adicionales). **Pendiente del usuario** — sin un VPS/dominio real no se puede confirmar la parte de HTTPS/Let's Encrypt/tiempo. Lo que sí se verificó localmente con Docker de verdad (no solo revisando el código): ambas imágenes construyen limpio, `docker compose up` deja `postgres`+`api` sanos, las migraciones se aplican solas, `/health` responde `ok`, y un valor de configuración inválido hace fallar el contenedor de inmediato con mensaje claro (T007/T008).

**Checkpoint**: en este punto, User Story 1 es completamente funcional — el sistema se despliega con un comando y queda accesible por HTTPS.

**Notas de implementación** (bugs reales encontrados al probar T007/T008 con `docker compose up`/`docker compose run` de verdad, no solo revisados en el código — ninguno de los dos aparece en `research.md` porque solo salieron a la luz con una instalación limpia):

- `apps/api/src/main.ts` importa `express` directamente, pero `express` nunca fue una dependencia directa de `apps/api/package.json` — solo llegaba disponible por el estado ya existente de `node_modules` en este checkout. Un `pnpm install` limpio (exactamente lo que hace `Dockerfile.api`) no lo resuelve y el contenedor no arranca (`Cannot find module 'express'`). Corregido agregando `"express": "^5.2.1"` (misma versión que ya trae `@nestjs/platform-express` como dependencia transitiva) a `apps/api/package.json`.
- `apps/api/src/common/logger/json-logger.service.ts` hacía `JSON.stringify(error)` sobre errores que no son string — `Error.prototype.message` no es una propiedad propia enumerable, así que cualquier error lanzado antes de una request HTTP (como `validateEnv()` fallando al arranque) se registraba como `{}`, vacío — rompiendo el propio FR-005 que esta historia tiene que cumplir. Corregido: `JsonLoggerService` ahora extrae `.message`/`.stack` explícitamente cuando el valor recibido es un `Error`.

---

## Phase 4: User Story 2 - Mi sesión sobrevive al despliegue y al reinicio (Priority: P1)

**Goal**: la sesión sigue activa tras un reinicio/redespliegue, el login funciona correctamente detrás de Caddy, los intentos fallidos de login se bloquean temporalmente, y la imagen de una factura nunca es accesible de forma anónima.

**Independent Test**: iniciar sesión, reiniciar el sistema (o redesplegar), confirmar que sigue autenticado; confirmar por separado que una imagen de factura responde con error sin sesión válida.

### Implementation for User Story 2

- [X] T012 [P] [US2] `apps/api/src/main.ts`: agregar `app.set('trust proxy', 1)` sobre la instancia de Express — resolución correcta de IP real detrás de Caddy (research.md § 2, relevante para FR-028 y para T013).
- [X] T013 [P] [US2] `apps/api/src/modules/auth/auth.ts`: agregar `advanced.ipAddress.trustedProxies` (red interna de `docker-compose`) y `rateLimit.customRules` para `/sign-in/email` a 5 intentos / 900s (research.md § 3) — usa el rate limiter ya incorporado de Better Auth, sin librería nueva. `docker-compose.yml` fija la subred `172.28.0.0/16` de `myivo_internal` (antes autoasignada) para que `trustedProxies` tenga un valor estable, y fija `NODE_ENV: production` en el servicio `api` (antes dependía de que `apps/api/.env` lo tuviera bien puesto) — sin esto el rate limiter de Better Auth queda apagado por defecto.
- [X] T014 [P] [US2] Verificar que `GET /invoices/:id/image` (`apps/api/src/modules/invoices/invoices.controller.ts`) ya rechaza una request sin sesión válida y dueña de la factura (`SessionUsuarioGuard` + RLS existentes) — confirma FR-009 sin código nuevo. Verificado en vivo contra el contenedor real: `403 {"message":"Forbidden resource",...}` sin cookie de sesión.
- [X] T015 [US2] Ejecutar `quickstart.md` § 3: login sobrevive a `docker compose restart api`; 6 intentos de login fallidos seguidos quedan bloqueados temporalmente; imagen sin sesión responde 401/403. **2 de 3 verificados en vivo** contra el contenedor real con `NODE_ENV=production`: intentos 1-5 a `/auth/sign-in/email` → 401 (credenciales inválidas), intento 6 y 7 → 429 "Too many requests" (rate limit); imagen sin sesión → 403 (T014). La sobrevivencia de sesión a un restart no se probó en vivo (exigiría una cuenta real verificada por correo, que no puedo crear ni verificar por mi cuenta) — está garantizada arquitectónicamente: las sesiones de Better Auth viven en la tabla `sesiones` de Postgres, no en memoria del proceso `api`, y `BETTER_AUTH_SECRET` es el mismo valor estático en cada arranque — confirmarlo con una cuenta real queda para vos.

**Checkpoint**: sesión persistente entre reinicios/redespliegues, login protegido contra fuerza bruta, imágenes nunca anónimas.

---

## Phase 5: User Story 3 - Procesar el backlog completo sin tumbar el sistema (Priority: P1)

**Goal**: un lote de 80 archivos termina completo sin saturar memoria ni el proveedor de extracción; límites claros de tamaño/cantidad; progreso visible.

**Independent Test**: subir 80 archivos de una vez, confirmar que los 80 llegan a un estado final del pipeline, ninguno fallido por saturación propia.

### Implementation for User Story 3

- [X] T016 [US3] `apps/api/src/config/env.schema.ts`: agregar `UPLOAD_MAX_FILE_SIZE_MB` (default `20`), `UPLOAD_MAX_FILES_PER_BATCH` (default `100`), `EXTRACTION_MAX_CONCURRENCY` (default `3`) — contracts/env-vars.md.
- [X] T017 [P] [US3] Documentar las 3 variables nuevas en `apps/api/.env.example`.
- [X] T018 [US3] `apps/api/src/modules/invoices/invoices.module.ts`: configurar `MulterModule.registerAsync` leyendo `UPLOAD_MAX_FILE_SIZE_MB`/`UPLOAD_MAX_FILES_PER_BATCH` (T016) hacia `limits.fileSize`/`limits.files` de Multer (FR-012/FR-013). Verificado contra el código fuente real de `@nestjs/platform-express`: `FilesInterceptor` inyecta `MULTER_MODULE_OPTIONS` — sin `MulterModule` importado en el mismo módulo del controller, esos límites nunca se aplicaban.
- [X] T019 [P] [US3] `apps/api/src/common/filters/global-exception.filter.ts`: manejar `MulterError` (`LIMIT_FILE_SIZE`/`LIMIT_FILE_COUNT`) devolviendo un 400 con mensaje claro, en vez de caer al branch genérico de 500. Hallazgo al revisar el código fuente de NestJS: `FilesInterceptor` ya traduce estos errores a `HttpException` (`PayloadTooLargeException`/`BadRequestException`) con texto en inglés ("File too large"/"Too many files") — no caían al 500 genérico como se esperaba. Se agregó solo la traducción a un mensaje claro en español, consistente con el resto de la app.
- [X] T020 [US3] Envolver el despacho de extracción en `apps/api/src/modules/invoices/invoices.controller.ts` (`subir()`/`reprocesar()`) con un limitador de concurrencia (`EXTRACTION_MAX_CONCURRENCY`, T016) — FR-011, research.md § 4. Implementado dentro de `ExtractionProcessor.procesar()` (no en el controller): la transición a `procesando` corre sin límite (FR-014, para que el lote entero se vea "procesando" de inmediato), solo la llamada al proveedor de extracción respeta la concurrencia. **Corrección sobre research.md § 4**: la decisión original era usar la librería `p-limit`; se descartó en la Fase 7 (T033) al encontrar que su versión actual es ESM-only y rompe los tests bajo Jest (`import()` dinámico sin `--experimental-vm-modules` — funcionaba en Docker/producción vía un provider async, pero no en el test runner). Se reemplazó por `apps/api/src/modules/extraction/limitador-concurrencia.ts`: un semáforo con cola de ~30 líneas, sin dependencia externa, mismo comportamiento, inyectado vía el mismo token `EXTRACTION_CONCURRENCY_LIMITER`. Verificado con `docker compose up` (arranque limpio, `/health` en `ok`) y con la suite de tests completa (T033) — esta última es la que detectó el problema real.
- [X] T021 [P] [US3] Verificar que la sección "Lote de hoy" de `apps/web/src/pages/Captura.tsx` ya muestra el progreso por documento (estado por factura) sin cambios adicionales — confirma FR-014 (research.md § 6). Confirmado: línea `{listas} listas · {enProceso} en proceso`, con polling de 2s ya implementado.
- [ ] T022 [US3] Ejecutar `quickstart.md` § 4: lote de 80 archivos, ninguno fallido por saturación; un archivo por encima de `UPLOAD_MAX_FILE_SIZE_MB` da un mensaje claro de límite excedido. **Parcial, pendiente del usuario**: `SessionUsuarioGuard` corre antes que `FilesInterceptor` en el ciclo de vida de NestJS (Guards → Interceptors), así que no pude ejercer el límite de Multer sin una sesión real autenticada — no puedo crear ni verificar una cuenta por correo por mi cuenta. Tampoco disparé una extracción real de 80 archivos (costo real contra el proveedor de IA, no algo que deba hacer sin permiso explícito). Lo que sí se verificó: arranque limpio del contenedor con toda la nueva red de DI (Multer + limitador de concurrencia), `/health` en `ok`, y la configuración revisada línea por línea contra el código fuente real de NestJS/Multer.

**Checkpoint**: lotes grandes se procesan de forma controlada; límites de tamaño/cantidad aplicados con mensajes claros.

---

## Phase 6: User Story 5 - Puedo recuperar todo si el servidor se pierde (Priority: P1)

**Goal**: respaldo diario automático (BD + imágenes), cifrado, en un destino externo; restauración documentada y probada al menos una vez de punta a punta; estado del último respaldo consultable sin leer logs.

**Independent Test**: ejecutar el respaldo, confirmar que el archivo cifrado llega al destino externo, restaurarlo en un servidor limpio y verificar que coincide exactamente con el origen.

### Implementation for User Story 5

- [ ] T023 [P] [US5] Agregar `MYIVO_BACKUP_ENCRYPTION_KEY` y `MYIVO_BACKUP_REMOTE` al `.env.example` de la raíz (contracts/env-vars.md) — `MYIVO_BACKUP_RETENCION_DIAS` ya existe, sin cambio.
- [ ] T024 [US5] Extender `scripts/backup-db.sh`: empaquetar `invoice_images` (vía `docker compose exec -T api tar ...`), combinar con el `.sql.gz` existente, cifrar con `age` usando `MYIVO_BACKUP_ENCRYPTION_KEY`, subir con `rclone` a `MYIVO_BACKUP_REMOTE`, y salir con error (sin dejar ningún artefacto sin cifrar) si falta cualquiera de las dos variables — contracts/backup-restore.md.
- [ ] T025 [US5] Crear `scripts/restore.sh`: descarga (si aplica)/descifrado con `age -d`/destar/restauración de `pg_dump` + imágenes; verificación de que el destino está vacío antes de escribir, exigiendo `--forzar` si no lo está — contracts/backup-restore.md.
- [ ] T026 [P] [US5] `scripts/backup-db.sh`: escribir `backups/ultimo-estado.json` (`{fecha, resultado, mensaje}`) en cada corrida, éxito o fallo — insumo de T041 (US8) y del propio `GET /health`.
- [ ] T027 [P] [US5] `apps/api/src/app.controller.ts`: extender `GET /health` para leer `backups/ultimo-estado.json` e incluir `ultimoRespaldo` en la respuesta (contracts/health.md; `null` si el archivo todavía no existe) — FR-021.
- [ ] T028 [P] [US5] Reescribir la nota "pendiente" de copia externa en `README.md` § Despliegue, enlazando a `contracts/backup-restore.md`/`quickstart.md` en vez de duplicar el procedimiento.
- [ ] T029 [US5] Ejecutar `quickstart.md` § 6 completo, incluido el simulacro de restauración contra un entorno desechable (FR-020 exige que se haya probado al menos una vez de punta a punta) — confirma SC-005/SC-006.

**Checkpoint**: respaldo cifrado diario fuera del servidor, restauración ya probada de punta a punta, estado consultable sin leer logs.

---

## Phase 7: User Story 6 - Montos sin tope artificial (Priority: P1)

**Goal**: corregir el desborde de `Int` (tope real ~$21.474.836 COP) que impide guardar facturas de mayor valor, sin perder precisión ni datos existentes.

**Independent Test**: registrar/corregir una factura con un valor superior a $21,4 millones de COP y confirmar que se guarda, lista y suma correctamente.

### Implementation for User Story 6

- [X] T030 [US6] `apps/api/prisma/schema.prisma`: cambiar `Int` → `BigInt` en `Factura.subtotalCentavos`, `impuestoConsumoCentavos`, `propinaCentavos`, `totalCentavos`, y en `ItemFactura.valorUnitarioCentavos`, `valorTotalCentavos` (data-model.md § 1). `ivaPorTarifa` (columna `Json`) no cambia. **Hallazgo no anticipado en data-model.md**: `ValidacionDian.snapshotTotalCentavos` también era `Int` y también copia `factura.totalCentavos` al crear un snapshot (`validacion-dian.repository.ts`) — mismo bug de desborde, mismo fix, séptima columna.
- [X] T031 [US6] Generar la migración de Prisma (`prisma migrate dev --name montos_bigint`) — `ALTER COLUMN ... TYPE bigint`, sin pérdida de datos (Principio I/FR-024). Dos migraciones aplicadas: `montos_bigint` (las 6 columnas documentadas) + `validacion_dian_total_bigint` (la séptima, encontrada por TypeScript al correr `tsc` tras regenerar el cliente de Prisma — no fue necesario adivinar dónde más tocaba).
- [X] T032 [US6] `apps/api/src/modules/invoices/factura.repository.ts`: convertir en la frontera — `Number(...)` al leer en `aDominio()`, `obtenerItems()` y el agregado `_sum.totalCentavos` de `listar()`; `Prisma.IntNullableFilter` → `Prisma.BigIntNullableFilter` en el filtro `montoMin`/`montoMax`. Al escribir (`guardarResultadoExtraccion()`/`aplicarCorreccion()`) NO hizo falta envolver con `BigInt(...)`: el cliente de Prisma 7 acepta `number` directo para una columna `BigInt` — confirmado porque `tsc` no se quejó, no asumido. Mismo fix en `validacion-dian.repository.ts` para la séptima columna. `packages/domain`, los DTOs, el frontend y los reportes NO cambian de tipo (siguen en `number`) — research.md § 8.
- [X] T033 [US6] Correr los tests existentes de `packages/domain` y `apps/api` (`pnpm --filter @myivo/domain test`, `pnpm --filter @myivo/api test`) y confirmar que siguen en verde tras el cambio de tipo. **Encontró un bug real de la Fase 5 (US3)**: bajo Jest, el `import('p-limit')` dinámico de `extraction.module.ts` fallaba con "A dynamic import callback was invoked without --experimental-vm-modules" — funcionaba en Docker/producción pero no en el test runner. Se resolvió reemplazando `p-limit` por un limitador de concurrencia propio (`limitador-concurrencia.ts`, ~30 líneas, sin dependencia externa) — elimina el problema de raíz (ESM-only) en vez de parchear la configuración de Jest. Con el fix: 70 tests de dominio + 5 tests e2e de aislamiento entre cuentas (`apps/api/test/aislamiento-cuentas.e2e-spec.ts`, contra Postgres real ya migrado), todos en verde.
- [X] T034 [US6] Ejecutar `quickstart.md` § 7: corregir el total de una factura a más de $21.474.836 COP, confirmar que se guarda sin error y suma correctamente en Listado y Reporte Anual — SC-004. Verificado con un script desechable contra la BD real migrada (no vía HTTP — necesitaría una sesión autenticada que no puedo crear): una factura de $50.000.000 COP (5.000.000.000 centavos, 2,3x el tope de `Int4`) se guardó, se leyó de vuelta como `5000000000n` exacto, y su `SUM()` agregado también dio el valor exacto — sin datos de prueba dejados atrás.

**Checkpoint**: facturas de cualquier monto razonable se guardan sin error ni truncamiento; datos previos a la migración siguen intactos.

---

## Phase 8: User Story 4 - Ninguna factura queda atascada (Priority: P2)

**Goal**: una factura que queda en `procesando` por una interrupción del sistema se recupera automáticamente al arrancar, reutilizando exclusivamente transiciones ya definidas.

**Independent Test**: detener la API a mitad de una extracción en curso; al volver a arrancar, esa factura queda en un estado reintentable, con el evento en el log.

### Implementation for User Story 4

- [X] T035 [US4] Crear `apps/api/src/modules/arranque/recuperacion-arranque.service.ts` — hook `OnApplicationBootstrap`: lee `usuarios.id` (tabla sin RLS), por cada cuenta abre `aislarPorUsuario` y transiciona cada `Factura` en `procesando` a `fallida` (transición ya válida, reutiliza `FacturaRepository.actualizarEstado`), con un log estructurado por factura (data-model.md § Evento de recuperación al arranque) — FR-015/FR-016. Cada cuenta corre en su propio `try/catch` — una cuenta con datos inconsistentes no tumba el arranque ni bloquea la recuperación de las demás.
- [X] T036 [US4] Crear `apps/api/src/modules/arranque/arranque.module.ts` y registrarlo en `apps/api/src/app.module.ts`.
- [X] T037 [US4] Ejecutar `quickstart.md` § 5: matar la API a mitad de una extracción, reiniciar, confirmar que la factura pasa a `fallida` (reintentable) y que `docker compose logs api` muestra la entrada de recuperación. **Verificado de punta a punta con Docker real** (no simulado): se insertó una factura de prueba directo en la BD con `estado='procesando'`, se corrió `docker compose restart api`, y se confirmó (a) el log exacto `{"evento":"recuperacion_arranque","facturaId":"...","usuarioId":"...","estadoOrigen":"procesando","estadoDestino":"fallida"}`, y (b) por `psql` directo, que la fila realmente quedó en `estado='fallida'` en la base de datos. Datos de prueba borrados al terminar.

**Checkpoint**: un reinicio a mitad de extracción nunca deja una factura atascada indefinidamente en `procesando`.

---

## Phase 9: User Story 7 - El sistema responde rápido con años de historial (Priority: P3)

**Goal**: el listado/filtros y la búsqueda de duplicados por CUFE siguen respondiendo rápido con miles de facturas acumuladas.

**Independent Test**: cargar una cuenta con varios miles de facturas y confirmar que el listado filtrado y la búsqueda de duplicados responden sin degradación notoria.

### Implementation for User Story 7

- [ ] T038 [US7] `apps/api/prisma/schema.prisma`: agregar `@@index([usuarioId, eliminadaEn, fechaHoraCompra])` y `@@index([usuarioId, cufe])` al modelo `Factura` (data-model.md § 2). *Nota: mismo archivo que T030 (US6) — si ambas historias se trabajan en la misma rama, aplicar T030 primero y este después, o resolver el conflicto de merge; no es una dependencia real entre historias, solo un archivo compartido.*
- [ ] T039 [US7] Generar la migración de Prisma para los dos índices B-tree de T038, y agregar a mano en esa misma migración el índice GIN trgm (`CREATE INDEX ... ON facturas USING gin ("comercioNombreNormalizado" gin_trgm_ops)`) — Prisma no modela GIN trgm nativamente (mismo patrón ya usado para las políticas RLS).
- [ ] T040 [US7] Ejecutar `quickstart.md` § 8: `\d facturas` en `psql` confirma los 3 índices nuevos; medir tiempo de respuesta de listado filtrado y de detección de duplicados — SC-007.

**Checkpoint**: listado, filtros y búsqueda de duplicados responden sin degradación notoria a escala de miles de facturas.

---

## Phase 10: User Story 8 - Sé si el sistema está sano (Priority: P3)

**Goal**: un punto de verificación de salud reporta el estado real de la app y la base de datos; ningún log expone secretos.

**Independent Test**: consultar el punto de verificación de salud y confirmar que refleja el estado real, incluido cuando la base de datos falla.

### Implementation for User Story 8

- [ ] T041 [US8] `apps/api/src/app.controller.ts`: extender `GET /health` con una verificación real de base de datos (`SELECT 1` vía Prisma) en el campo `baseDeDatos` — se suma al campo `ultimoRespaldo` que T027 (US5) ya puede haber agregado; ambos campos son aditivos e independientes del orden en que se implementen (contracts/health.md) — FR-027.
- [ ] T042 [US8] Auditar `apps/api/src/common/filters/global-exception.filter.ts`, `apps/api/src/common/logger/json-logger.service.ts` y los mensajes de error de `scripts/backup-db.sh`/`scripts/restore.sh` (T024/T025) para confirmar que ningún secreto (`*_SECRET`, `*_API_KEY`, `DATABASE_URL`, `MYIVO_BACKUP_ENCRYPTION_KEY`) puede llegar a una línea de log o a una respuesta HTTP — corregir cualquier punto donde sí pueda pasar (FR-028).
- [ ] T043 [US8] Ejecutar `quickstart.md` § 9: detener Postgres, confirmar que `/health` responde con `baseDeDatos: "error"` (sin dejar de responder) y volver a levantar Postgres.

**Checkpoint**: el estado de salud (app + BD + respaldo) es consultable sin leer logs; ningún log expone secretos.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: cierre general, no específico de ninguna historia.

- [ ] T044 [P] Anotar en `README.md` § Stack que `age` y `rclone` son dependencias operativas nuevas (binarios, no paquetes npm) — nota corta, distinta de la reescritura de § Despliegue de T010/T028.
- [ ] T045 [P] Correr `pnpm typecheck` y `pnpm lint` en todo el monorepo y confirmar que quedan limpios.
- [ ] T046 Ejecutar `quickstart.md` completo, de principio a fin y en orden, contra un VPS/entorno desechable — cierre final de SC-001 a SC-008 antes de dar la feature por terminada.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — puede empezar de inmediato.
- **Foundational (Phase 2)**: depende de Setup (T001 para `.dockerignore`) — bloquea a US1.
- **User Stories (Phase 3-10)**: todas dependen de Foundational completo. El **código** de US2-US8 no depende del de las demás historias entre sí y puede escribirse en paralelo. La **validación real** (la tarea final de cada fase, que ejecuta `quickstart.md`) sí asume que US1 (Fase 3) ya está desplegado, porque toda la validación de esta feature es contra un `docker compose up` real — esto es explícito en el propio spec.md ("US1... es el requisito habilitante de todas las demás historias").
- **Polish (Phase 11)**: depende de que todas las historias que se vayan a entregar estén completas.

### User Story Dependencies

- **US1 (P1)**: sin dependencia de otra historia — es la base de despliegue.
- **US2, US3, US5, US6 (P1)**: sin dependencia de código entre sí ni de US1 — se pueden implementar en paralelo tras Foundational; su *validación* end-to-end asume US1 ya desplegado.
- **US4 (P2)**: sin dependencia de código de otra historia.
- **US7 (P3)**: sin dependencia real de US6 más allá de compartir `schema.prisma` como archivo (ver nota en T038) — secuenciar si se trabaja en la misma rama.
- **US8 (P3)**: `T041` es aditivo sobre el mismo endpoint que `T027` (US5) toca primero — cualquier orden funciona, ambos campos son independientes en la respuesta JSON.

### Parallel Opportunities

- Setup: T001 y T002 en paralelo.
- Foundational: T003 y T004 en paralelo.
- Tras Foundational, las historias US1, US2, US3, US5, US6 pueden asignarse a distintas personas/sesiones en paralelo (US4/US7/US8 igual, aunque son P2/P3 — conviene priorizarlas después).
- Dentro de cada historia, las tareas marcadas [P] (archivos distintos, sin dependencia entre sí) — ver ejemplo abajo.

---

## Parallel Example: User Story 2

```bash
# Estas 3 tareas tocan archivos distintos y no dependen entre sí:
Task: "apps/api/src/main.ts: agregar app.set('trust proxy', 1)"
Task: "apps/api/src/modules/auth/auth.ts: agregar advanced.ipAddress.trustedProxies y rateLimit.customRules"
Task: "Verificar que GET /invoices/:id/image ya rechaza sin sesión válida"
```

## Parallel Example: User Story 5

```bash
# T023, T026, T027, T028 tocan archivos distintos entre sí y son aditivos:
Task: "Agregar MYIVO_BACKUP_ENCRYPTION_KEY/MYIVO_BACKUP_REMOTE a .env.example"
Task: "backup-db.sh: escribir backups/ultimo-estado.json"
Task: "app.controller.ts: agregar ultimoRespaldo a GET /health"
Task: "README.md: reescribir la nota de copia externa pendiente"
# T024 (extender backup-db.sh con tar+cifrado+subida) y T025 (restore.sh) sí son secuenciales entre sí:
# restore.sh deshace exactamente el formato que backup-db.sh produce.
```

---

## Implementation Strategy

### MVP First (User Story 1 solamente)

1. Completar Fase 1: Setup.
2. Completar Fase 2: Foundational (bloquea US1).
3. Completar Fase 3: User Story 1.
4. **PARAR y VALIDAR**: ejecutar `quickstart.md` § 1-2 de forma independiente.
5. Ese es el punto en que "producción" existe de verdad — recién ahí tiene sentido seguir con el resto.

### Entrega incremental

Mismo acuerdo ya usado en features anteriores de este repo: cada historia se implementa, se valida de punta a punta contra el `quickstart.md`, y se da por completa antes de pasar a la siguiente — así `/speckit-implement` puede invocarse acotado a Setup + Foundational + una sola historia por vez, en vez de todo el feature de una sola pasada.

Orden recomendado (prioridad de spec.md): **US1 → US2 → US3 → US5 → US6** (las cinco P1, en este orden) **→ US4** (P2) **→ US7 → US8** (P3). Cada parada es un sistema en producción estrictamente más confiable que el anterior — ninguna historia deja al sistema peor de lo que estaba.

### Nota sobre US4, US7, US8 (P2/P3)

No son opcionales — todas tienen requisitos funcionales (`FR-015` a `FR-028`) igual de obligatorios que las P1. La priorización solo dice en qué orden se implementan si el tiempo es limitado; `spec.md` ya explica por qué cada una pesa menos que las P1 (US4: consecuencia de operar en un VPS real, no un riesgo del día a día; US7: aparece con el tiempo, no desde el primer día; US8: diagnóstico útil, no crítico para el uso diario).
