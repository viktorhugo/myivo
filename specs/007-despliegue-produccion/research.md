# Research: Despliegue en Producción

Cada decisión de abajo se verificó contra el código real del repositorio (no contra documentación genérica ni memoria de entrenamiento) — citas puntuales a archivo/línea donde aplica. El hallazgo general: casi todo lo que las 8 historias de usuario piden ya tiene un mecanismo parcial o completo en el código; el trabajo de esta feature es mayormente **terminar de conectar, corregir y endurecer** piezas existentes, no construir infraestructura nueva.

## 1. Reverse proxy y HTTPS automático

**Decision**: Mantener Caddy (ya scaffolded en `Caddyfile` y referenciado en `docker-compose.yml`/README). Corregir un bug real encontrado: el bloque `handle /api/* { reverse_proxy api:3000 }` actual **no quita el prefijo `/api`** antes de reenviar — pero ningún controller de NestJS está montado bajo `/api` (`main.ts` línea 25-30: "Sin prefijo /api: el proxy de Vite ya lo quita antes de reenviar al backend"). En dev, `apps/web/vite.config.ts` sí hace ese `rewrite: (path) => path.replace(/^\/api/, '')`; en el `Caddyfile` actual, ese `rewrite` equivalente falta. Fix: cambiar `handle /api/*` por `handle_path /api/*` (Caddy quita el prefijo coincidente antes de proxiar, a diferencia de `handle`).

**Rationale**: Caddy ya está elegido, ya tiene el `{$APP_DOMAIN}`/`{$CADDY_ACME_EMAIL}` correctamente parametrizados para TLS automático vía ACME. El bug de prefijo es exactamente el tipo de "paso manual olvidado" que US1 busca eliminar — sin este fix, CADA request a la API en producción devolvería 404.

**Alternatives considered**: Nginx + certbot (renovación manual por cron, más piezas móviles); Traefik (config por labels de Docker, pensado para muchos servicios dinámicos — sobredimensionado para un dominio único y estático). Ninguno aporta algo que Caddy no tenga ya, y ambos implicarían tirar el scaffold existente.

## 2. Sesión detrás del proxy inverso (US2, FR-006/FR-007)

**Decision**: No se necesita ningún cambio en la lógica de cookies de Better Auth. Se verificó en el código fuente instalado (`better-auth/dist/cookies/index.mjs`) que el flag `secure` de la cookie de sesión se deriva de `options.baseURL` (es decir, `BETTER_AUTH_URL`), **no** de `req.protocol` en tiempo de request:

```js
const secureCookiePrefix = (options.advanced?.useSecureCookies !== void 0
  ? options.advanced?.useSecureCookies
  : dynamicProtocol === "https" ? true
  : dynamicProtocol === "http" ? false
  : baseURLString ? baseURLString.startsWith("https://") : isProduction)
  ? SECURE_COOKIE_PREFIX : "";
```

Con `BETTER_AUTH_URL=https://facturas.tudominio.com` en producción, la cookie ya sale `Secure` sin tocar código. Lo que sí falta:
- Fijar `BETTER_AUTH_URL`/`WEB_ORIGIN` al dominio real en el `.env` de producción (README ya lo señala como pendiente).
- El fix de Caddy de la decisión 1 — sin él, el login nunca llega a la API detrás del proxy, sea cual sea el estado de la cookie.
- `app.set('trust proxy', 1)` en `main.ts` — Express no lo tiene hoy; no afecta el flag `secure` de la cookie (Better Auth no lo lee de Express), pero sí a `req.ip`/logging correctos detrás de Caddy (relevante para FR-028).

**Rationale**: Cambiar de Better Auth a `express-session` para "arreglar" esto tiraría el trabajo ya hecho de passkeys/2FA/login social de `specs/006-multi-usuario` sin necesidad — el mecanismo ya es compatible con un proxy TLS-terminating, solo le faltaba la configuración de producción real, que hoy literalmente no existe (no hay `docker-compose` con `api`+`caddy` corriendo todavía).

**Alternatives considered**: `express-session` + `connect-pg-simple` (reescritura grande, regresivo); forzar `secure: true` a mano (innecesario, ya se deriva correctamente de `BETTER_AUTH_URL`).

## 3. Bloqueo de intentos fallidos de login (FR-008)

**Decision**: Usar el rate limiter **ya incorporado** en Better Auth en vez de añadir una librería nueva. Verificado en `better-auth/dist/context/create-context.mjs`: `enabled: options.rateLimit?.enabled ?? isProduction` — se activa solo con `NODE_ENV=production`, sin flag adicional. Y en `better-auth/dist/api/rate-limiter/index.mjs`, `getDefaultSpecialRules()` ya define una regla específica para rutas de auth:

```js
{ pathMatcher: (path) => path.startsWith("/sign-in") || path.startsWith("/sign-up") || ..., window: 10, max: 3 }
```

Eso ya es más estricto que el estándar de industria citado en las Assumptions del spec. Se ajusta a 5 intentos / 15 min (900s) — el valor que el propio spec sugiere — vía `rateLimit.customRules` en `auth.ts` para la ruta `/sign-in/email`, específicamente para no bloquear de más a un usuario real que se equivoca de contraseña dos veces seguidas en el celular.

La clave del rate limit es `IP + path` (`createRateLimitKey`), y la IP se resuelve leyendo `X-Forwarded-For` (`getIp` en `@better-auth/core/utils/ip.ts`) — con fallback a `127.0.0.1` solo en dev/test. Se configura explícitamente `advanced.ipAddress.trustedProxies` (la red interna de `docker-compose`) para que la resolución de IP real detrás de Caddy sea explícita y no dependa del comportamiento por defecto de un único hop.

**Rationale**: Cero código nuevo, cero dependencia nueva — solo configuración sobre un mecanismo que ya se instala con `better-auth` y ya corre en cada request de auth. Satisface FR-008 literalmente ("bloquear temporalmente... después de un número razonable de intentos").

**Alternatives considered**: `@nestjs/throttler` (no está instalado — grep al lockfile lo confirma —, y duplicaría un mecanismo que Better Auth ya aplica en las mismas rutas); una columna de intentos fallidos por cuenta con `lockedUntil` (el propio modelo `TwoFactor` ya usa ese patrón para 2FA, pero para login inicial sería reinventar lo que el rate limiter de la librería ya cubre).

## 4. Concurrencia controlada en extracción de lote (US3, FR-011)

**Decision**: `InvoicesController.subir()` hoy despacha `this.extractionProcessor.procesar(...)` **sin ningún límite** dentro de un `for` — un lote de 80 archivos dispara 80 llamadas concurrentes al proveedor de extracción de inmediato (`invoices.controller.ts` líneas 68-80). Se introduce una puerta de concurrencia alrededor de ese despacho, con un límite configurable por variable de entorno (default conservador, p. ej. 3 extracciones simultáneas).

**Actualizado durante la implementación (Fase 5/US3, tasks.md T020)**: la primera implementación usó la librería `p-limit` (ya presente como dependencia transitiva). Se descartó al llegar a la Fase 7 (T033) y encontrar que su versión actual es ESM-only (`"type": "module"`) — funcionaba en Docker/producción (vía un provider async de NestJS con `await import(...)`), pero rompía la suite de tests bajo Jest (`import()` dinámico sin `--experimental-vm-modules`, no soportado sin reconfigurar todo el test runner). Se reemplazó por un limitador propio (`apps/api/src/modules/extraction/limitador-concurrencia.ts`, un semáforo con cola de ~30 líneas, sin dependencia externa) — mismo comportamiento, elimina el problema de raíz en vez de trabajar alrededor de él.

**Rationale**: El caso de uso real (US3) es subir un backlog de decenas de fotos de una sola vez desde el celular. Sin límite, eso satura memoria del contenedor (sharp decodificando N imágenes a la vez) y golpea el rate limit del proveedor de IA de golpe. Un límite en proceso es proporcional al problema real: un solo usuario, un solo proceso Node, sin necesidad de coordinar entre instancias.

**Alternatives considered**: BullMQ + Redis (añade un servicio nuevo — contradice el techo de <15 USD/mes y "sin servicios adicionales" del Principio VII para un problema que no necesita persistencia de cola entre reinicios: el patrón fire-and-forget + reintento manual vía `POST /invoices/:id/reprocess` que ya existe cubre el caso de un fallo a medio lote); una tabla de cola en Postgres (complejidad de un sistema de jobs para un problema que es, en esencia, "no dispares 80 llamadas HTTP salientes a la vez").

## 5. Límites de tamaño y cantidad de archivos (FR-012/FR-013)

**Decision**: `FilesInterceptor('files')` en `invoices.controller.ts` no pasa ningún `MulterOptions.limits` hoy — Multer acepta cualquier tamaño/cantidad. Se configura vía `MulterModule.registerAsync` en `invoices.module.ts` (lee `ConfigService`), con `limits.fileSize` y `limits.files` desde dos variables de entorno nuevas (defaults: ~20 MB/archivo, cantidad cómoda por encima de 80 — ver Assumptions del spec). El error de Multer (`LIMIT_FILE_SIZE`/`LIMIT_FILE_COUNT`) debe llegar como un 400 legible — verificar que `GlobalExceptionFilter` lo mapea con un mensaje claro (hoy cae al branch genérico "Error interno del servidor" porque `MulterError` no es `HttpException` ni `ZodError`; se necesita un `catch` explícito).

**Rationale**: Rechazar ANTES de bufferizar el archivo completo en memoria es el único punto donde el límite tiene sentido — un chequeo posterior ya pagó el costo de memoria que se quería evitar.

**Alternatives considered**: Chequeo manual de tamaño después de recibir el buffer completo — descartado, ya se explicó por qué.

## 6. Visibilidad de progreso del lote (FR-014)

**Decision**: No se necesita contrato nuevo. `POST /invoices` ya devuelve el arreglo completo de `Factura[]` creadas (una por archivo) de inmediato, y la pantalla de Captura (`apps/web/src/pages/Captura.tsx`, alineada a diseño en sesiones previas) ya tiene la sección "Lote de hoy" con badges de estado por documento (`ICONO_POR_ESTADO`) y polling. Con el límite de concurrencia de la decisión 4, el usuario verá los estados (`recibida`→`procesando`→`extraída`/`necesita_revisión`/`fallida`) avanzar progresivamente en esa misma lista — exactamente el conteo "cuántos ya se procesaron / cuántos quedan" que pide FR-014.

**Rationale**: Evitar inventar un endpoint o campo de progreso nuevo cuando la información ya existe vía el `estado` de cada `Factura` y la UI ya la consume. Verificado leyendo el código de `Captura.tsx` de esta misma sesión (Fase 3 del rediseño visual), no asumido.

**Alternatives considered**: Un endpoint `GET /invoices/batch/:loteId/progress` — trabajo nuevo para duplicar información que el listado ya expone.

## 7. Recuperación de facturas atascadas al arranque (US4, FR-015/FR-016)

**Decision**: `procesando → fallida` **ya es una transición válida** en la máquina de estados (`packages/domain/src/state-machine/factura-estado.ts` línea 12) — es la misma que usa el propio `catch` de `ExtractionProcessor.procesar()` hoy ante cualquier error. La recuperación al arranque reutiliza exactamente ese camino: un hook `OnApplicationBootstrap` en un módulo nuevo (`modules/arranque/`) que:

1. Lee `SELECT id FROM usuarios` — esta tabla **no tiene RLS habilitado** (solo `facturas` y sus dependientes lo tienen, confirmado en `prisma/migrations/20260801043357_rls_policies/migration.sql`), así que es una lectura directa sin necesidad de bypass.
2. Para cada `usuarioId`, abre una transacción con `aislarPorUsuario` (el mismo helper que ya usa `ExtractionProcessor`) y transiciona cada `Factura` en `procesando` de esa cuenta a `fallida`, registrando un log estructurado por factura (FR-016: factura afectada, estado origen/destino, momento).

**Rationale**: Cero transiciones nuevas (cumple el requisito explícito de FR-015 y el Principio VIII de la constitution: "las transiciones no definidas MUST fallar de forma explícita"), cero necesidad de un rol Postgres `BYPASSRLS` (el propio comentario de la migración de RLS ya descartó esa complejidad para una instancia personal/familiar — reutilizar esa misma decisión aquí, no reabrirla). Iterar por cuenta es trivialmente barato: el número de cuentas en esta instancia es pequeño por diseño (Principio VII).

**Alternatives considered**: Un rol `BYPASSRLS` separado para hacer un `UPDATE` masivo cross-cuenta en una sola sentencia — más rápido en teoría, pero introduce un segundo rol de Postgres a gestionar en el `.env`/compose por una ganancia de performance irrelevante a esta escala (barrido de arranque, no un hot path). Un cron periódico en vez de al arranque — no es lo que pide US4 (que es específicamente sobre reinicios/redespliegues).

## 8. Precisión monetaria — el bug de los ~21,4 millones de COP (US6, FR-022/023/024)

**Decision**: Confirmado el origen exacto del bug: `subtotalCentavos`, `impuestoConsumoCentavos`, `propinaCentavos`, `totalCentavos` (`Factura`) y `valorUnitarioCentavos`, `valorTotalCentavos` (`ItemFactura`) son `Int` en `schema.prisma` → Postgres `int4`, tope `2.147.483.647` centavos = **$21.474.836,47 COP exactos** — coincide al centavo con el límite que describe el spec. `ivaPorTarifa.valorCentavos` vive dentro de una columna `Json`, no en un `int4` — nunca estuvo sujeto a este límite, no necesita cambio.

Fix: migrar esas 6 columnas de `Int` a `BigInt` (Postgres `bigint`, 8 bytes) — un `ALTER COLUMN TYPE` sin pérdida, porque `bigint` es superconjunto exacto del rango de `int4` (cumple FR-024: los datos existentes quedan intactos). La conversión JS↔Postgres se contiene en la frontera de `factura.repository.ts` (`aDominio()`, `obtenerItems()`, el agregado `_sum` de `listar()`): `Number(valorBigInt)` al leer, `BigInt(valorNumber)` al escribir. El dominio (`packages/domain`), los DTOs, el frontend y los reportes (Excel/PDF/reporte anual) **no cambian** — siguen viendo `number`.

Esto es seguro porque `Number.MAX_SAFE_INTEGER` (9.007.199.254.740.991) en centavos equivale a ~90 billones de COP — ninguna factura individual ni la suma acumulada de miles de facturas reales de una persona se acerca remotamente a ese techo. El problema real nunca fue "JS no puede representar el número" (sí puede, con margen enorme) — fue que **Postgres `int4` sí lo desbordaba** mucho antes.

**Rationale**: Contener el cambio a la capa de infraestructura (Principio V: el dominio no debe saber que Postgres tiene un tipo de 4 bytes) minimiza el radio de impacto a un solo archivo de mapeo, en vez de propagar `bigint` nativo de JS (que no es serializable por `JSON.stringify` sin un paso extra) a través de dominio, API, frontend y generación de reportes.

**Alternatives considered**: Propagar `bigint` de JS end-to-end (dominio, DTOs, frontend) — técnicamente más "puro", pero exige serialización especial en cada respuesta JSON, tipos `string`/`bigint` en el frontend para algo que no lo necesita a esta escala, y tocar `reporte-excel.service.ts`/`reporte-pdf.service.ts`/`cuadre-monetario.ts`/`reporte-anual.ts` sin ninguna ganancia real de corrección. `Decimal`/Postgres `numeric` (permitido por la constitution como alternativa a "entero en centavos", pero un cambio de tipo más invasivo — objeto `Decimal` en vez de `number` en todo el código — sin necesidad, dado que el dominio ya trabaja en centavos enteros).

## 9. Índices para escala (US7, FR-025/FR-026)

**Decision**: Se confirmó, leyendo las 10 migraciones existentes, que la tabla `facturas` **no tiene ningún índice más allá de la llave primaria** — ni siquiera en `usuarioId`, la columna por la que se filtra literalmente cada consulta (RLS incluido). `pg_trgm` ya está instalado (`CREATE EXTENSION IF NOT EXISTS pg_trgm` en la migración de duplicados) pero nunca se creó el índice GIN que lo aprovecha — la búsqueda difusa de comercio (`duplicate-matching.service.ts`, `$queryRaw` con `similarity(...)`) hoy escanea secuencialmente.

Se añaden:
- `@@index([usuarioId, eliminadaEn, fechaHoraCompra])` — cubre el listado/filtro por fecha (FR-025), que además siempre excluye soft-deleted.
- `@@index([usuarioId, cufe])` — la búsqueda de duplicado exacto por CUFE (`detectarYRegistrar`, hoy un `findFirst` sin índice) — FR-026.
- `CREATE INDEX ... ON facturas USING gin (comercioNombreNormalizado gin_trgm_ops)` (SQL crudo en la migración, Prisma no modela GIN trgm de forma nativa) — acelera el prefiltro de la coincidencia difusa.

**Rationale**: Este es el hallazgo de mayor impacto de esta investigación para FR-025/FR-026/SC-007 — no hacía falta ningún cambio arquitectónico (no se necesita un motor de búsqueda aparte), solo cerrar un vacío real y verificado en el esquema actual.

**Alternatives considered**: Meilisearch/Elasticsearch para la búsqueda de comercio — sobredimensionado para "miles de filas por cuenta"; un índice B-tree resuelve el filtrado exacto, y GIN trgm ya cubre la coincidencia difusa sin un servicio nuevo.

## 10. Estrategia de build de Docker

**Decision**: `Dockerfile.api` y `Dockerfile.web`, ambos multi-stage sobre `node:22-bookworm-slim` (Debian/glibc), **no** `node:22-alpine`. La imagen de `apps/web` (`vite build` → `dist/`) no corre su propio servidor Node — su salida se copia al stage/imagen de Caddy en `/srv/web`, tal como ya lo documenta el comentario del `Caddyfile` actual (`root * /srv/web`). El build usa pnpm + Turborepo (`pnpm --filter @myivo/api build`, con `prisma generate` antes, igual que ya hace `.github/workflows/ci.yml`).

**Rationale**: `sharp`, `argon2` (dependencia de build ya declarada en `pnpm-workspace.yaml` → `onlyBuiltDependencies`) y el motor de Prisma son binarios nativos con mejor soporte prebuilt en glibc que en musl (Alpine) — evita compilación nativa a build-time en un VPS de 1-2 GB de RAM. Servir el SPA desde Caddy (que igual está corriendo para TLS) evita un proceso Node adicional solo para archivos estáticos.

**Alternatives considered**: Alpine (imagen más chica, pero riesgo real de tener que compilar `sharp`/`argon2` desde fuente en un VPS pequeño — el mismo tipo de problema ya documentado para el Mac Intel del usuario, aquí trasladado al servidor); un contenedor Node aparte sirviendo el build de `apps/web` con `vite preview`/Express — proceso y memoria extra sin necesidad, ya que Caddy sirve estáticos gratis.

## 11. Migraciones automáticas en cada despliegue (FR-002)

**Decision**: `prisma migrate deploy` como parte del arranque del contenedor `api` (entrypoint, antes de `node dist/main.js`), no como paso manual.

**Rationale**: Es exactamente lo que pide FR-002 ("sin que el usuario ejecute ninguna migración a mano") y es el patrón estándar de Prisma en producción: idempotente, seguro de correr en cada despliegue aunque no haya migraciones pendientes.

**Alternatives considered**: Job de migración separado que el usuario dispara a mano — contradice FR-002 explícitamente.

## 12. Respaldo cifrado fuera del servidor (US5, FR-017/018/018a/019/020)

**Decision**: Extender `scripts/backup-db.sh` (no reemplazarlo — ya tiene rotación local de 14 días y falla ruidosamente en dump vacío, ambos reutilizables) para que además:
1. Empaquete el contenido de `invoice_images` junto al `.sql.gz`.
2. Cifre el paquete resultante con **`age`** (binario estático único, cifrado simétrico moderno con AEAD — evita la gestión de keyring de GPG y los defaults débiles de `openssl enc` clásico) usando una llave de una variable de entorno nueva (FR-018a: la misma llave MUST quedar también en el gestor de contraseñas personal del usuario, fuera del servidor — un paso manual documentado en el quickstart, no automatizable desde el propio script).
3. Suba el archivo cifrado con **`rclone`** (binario estático único, soporte nativo S3-compatible incluyendo Backblaze B2, maneja reintentos/multipart sin reinventar nada) a un remoto configurado por el usuario.
4. Escriba un pequeño marcador de estado (`backups/ultimo-estado.json`: fecha, resultado, mensaje) — no una tabla en la base de datos que se está respaldando (ver decisión 13).

`scripts/restore.sh` (nuevo): procedimiento inverso documentado — descarga, descifra, restaura `pg_dump` + destar de imágenes sobre un servidor limpio. FR-020 exige que se haya probado al menos una vez de punta a punta antes de darse por completo — eso queda como paso explícito del quickstart (Fase 1, no algo que este plan pueda marcar "hecho" sin ejecutarlo).

**Rationale**: Both `age` y `rclone` son binarios estáticos sin dependencias de runtime — se agregan al Dockerfile o al VPS sin ceremonia, consistentes con "sin servicios adicionales" del Principio VII. Extender el script existente respeta el trabajo ya hecho (rotación, manejo de errores) en vez de descartarlo.

**Alternatives considered**: GPG (gestión de keyring innecesaria para una sola llave simétrica); `openssl enc` crudo (defaults históricamente débiles — sin autenticación integrada, a diferencia del AEAD de `age`); subir directo a la API S3 de B2 a mano con `curl`/`aws-cli` (reinventar reintentos y multipart que `rclone` ya resuelve).

## 13. Cómo saber si el respaldo de anoche falló, sin leer logs (US5 AC5, SC-006, FR-021)

**Decision**: El endpoint de salud (que FR-027/US8 de todos modos requiere) se extiende para leer `backups/ultimo-estado.json` del disco y exponerlo (`{ "ultimoRespaldo": { "fecha": "...", "resultado": "ok" | "fallido" } }`) junto al estado de la app y la BD.

**Rationale**: Reutiliza un endpoint que esta misma feature ya está obligada a construir (FR-027), en vez de agregar una pantalla o endpoint dedicado solo para esto — resuelve SC-006 ("confirmar en menos de 1 minuto, sin leer logs") con la superficie mínima. Deliberadamente un archivo en disco, no una fila en la base de datos: preguntar "¿mi respaldo de la BD funcionó?" no debería depender de poder consultar esa misma BD.

**Alternatives considered**: Una pantalla de historial de respaldos en `apps/web` — trabajo de UI real, más allá de lo que esta feature (operacional, no de producto) necesita para cumplir SC-006.

## Costo operativo (Principio VII, verificación de la decisión ya tomada esta sesión)

Sin cambios respecto a lo ya estimado en el README: VPS pequeño (~4-6 USD/mes) + extracción LLM (<2 USD/mes a este volumen) + almacenamiento de objetos externo para el respaldo cifrado (proveedor tipo Backblaze B2, del orden de centavos de USD/GB-mes para el tamaño de una base de datos + imágenes de un uso personal). Total muy por debajo de 15 USD/mes. Esta feature no reabre la decisión de gestor de base de datos (Postgres autoalojado, ya ratificada) ni introduce almacenamiento blockchain (ya descartado esta sesión).
