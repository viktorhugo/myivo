# Research: Registro abierto con aislamiento total entre usuarios

## 1. Librería de autenticación

**Decision**: `better-auth`, con su adaptador oficial de Prisma.

**Rationale**: Verificado que **Lucia está deprecada desde marzo 2025** — su propio equipo la reposicionó como material educativo, no como librería a instalar; no era una opción real pese a ser la que más aparece en memoria de entrenamiento por ese motivo exacto (evitar recomendar algo desactualizado sin verificar fue el punto de este research). Better Auth es hoy el estándar de facto para auth self-hosted en TypeScript: soporta Prisma con un adaptador oficial (`better-auth/adapters/prisma`), sesiones por cookie `HttpOnly` — mismo modelo mental que el `express-session` ya usado en `apps/api` hoy, no exige migrar a JWT — y trae verificación de correo, cambio de contraseña, y passkeys como funcionalidad de primera clase o plugins, en vez de tener que construirlos a mano. Existen plantillas de integración publicadas específicamente para NestJS + Prisma + PostgreSQL, el stack exacto de este proyecto.

**Alternatives considered**:
- **Lucia**: descartada — deprecada, ver arriba.
- **Passport.js** (`@nestjs/passport`): sigue siendo viable y tiene integración NestJS oficial, pero es un framework de estrategias de bajo nivel — verificación de correo, gestión de contraseña, y passkeys quedarían por construir a mano, más superficie propia para una funcionalidad de seguridad crítica.
- **Auth.js**: se replegó hacia Better Auth según la evidencia encontrada; no es una opción independiente hoy.
- **Proveedor de auth hospedado por terceros** (Clerk, Auth0, Supabase Auth): descartado de entrada — violaría directamente el Principio VII (autoalojado, cero dependencia de infraestructura de terceros para datos sensibles). Better Auth es explícitamente "el Clerk autoalojado", por diseño.

## 2. Proveedor de correo transaccional (verificación de registro)

**Decision**: Resend.

**Rationale**: Esta feature introduce la primera necesidad real de enviar correo saliente (Clarifications, sesión 2026-07-30 — verificación de correo obligatoria). Resend ofrece 3.000 correos/mes gratis vía API — para una instancia personal/familiar con un puñado de registros, esto no tiene techo real. Se integra directamente con Better Auth en los patrones ya documentados.

**Alternatives considered**:
- **Amazon SES**: más barato a gran escala (0.10 USD/1000 correos tras el tier gratuito), pero exige más configuración (verificación de dominio, salir del sandbox de SES) para un volumen que nunca la va a necesitar — complejidad que no se justifica aquí.
- **SMTP genérico (p. ej. una cuenta de correo personal)**: se descartó como recomendación por fragilidad de entregabilidad (spam/límites de envío) para algo tan crítico como el único paso de verificación de una cuenta nueva.

**Nota de costo (constitution Principio VII)**: el envío de correo de verificación es una dependencia operativa nueva, pero de costo cero al volumen esperado — no compromete el objetivo de <15 USD/mes.

## 3. Aislamiento de datos entre cuentas: Row-Level Security de PostgreSQL

**Decision**: además de acotar cada consulta por `usuarioId` a nivel de aplicación (Prisma `where`), habilitar **Row-Level Security (RLS) de PostgreSQL** en las tablas relevantes como una segunda capa — la base de datos garantiza el aislamiento aunque el código de la aplicación tenga un bug y olvide un filtro.

**Rationale**: Verificado como la práctica recomendada en 2026 para aislamiento multi-tenant sobre Postgres+Prisma — "no es opcional para aplicaciones SaaS modernas". Encaja exactamente con el nivel de exigencia que la constitution exige aquí ("aislamiento total... no negociable", Principio VII v2.0.0) — un requisito de esta naturaleza merece más que confiar únicamente en que cada consulta, presente y futura, recuerde el filtro correcto.

**Detalle técnico verificado (crítico, no trivial)**: el patrón correcto es envolver las consultas de cada request en una transacción de Prisma y usar `SET LOCAL` (no `SET`) para fijar el `usuarioId` como variable de sesión de Postgres, dentro de esa misma transacción — nunca fuera de ella. Esto importa porque con connection pooling, el pool solo garantiza que todas las queries de una misma *transacción* comparten la misma conexión física; `SET` (sin `LOCAL`) o fijar la variable fuera de una transacción puede filtrarse a la conexión de otra request cuando el pool la reutiliza — exactamente el tipo de fuga silenciosa que esta feature existe para prevenir. Para propagar una única transacción a través de todos los servicios que toca un request en NestJS (sin pasar el cliente de Prisma a mano por cada capa), se investigó `@nestjs-cls/transactional`, que usa continuation-local storage para esto — se recomienda adoptarlo en vez de reimplementar la propagación de contexto a mano para un mecanismo crítico de seguridad.

**Alternatives considered**:
- **Solo aislamiento a nivel de aplicación** (un `where: { usuarioId }` en cada consulta, sin RLS): más simple de implementar hoy, pero sin la capa de defensa adicional que la propia constitution pide ("no negociable") — un solo `findMany` sin el filtro en una feature futura sería una fuga real, silenciosa, y sin ninguna red de seguridad que la detenga.
- **Aislamiento por esquema separado por cuenta** (schema-per-tenant): descartado — mucho más complejo operativamente (migraciones × N esquemas) para el volumen esperado (instancia personal/familiar, no cientos de organizaciones), sin beneficio real aquí.

## 4. Migración de los datos existentes de Victor

**Decision**: un script de migración de datos (no solo de esquema) ejecutado una sola vez al desplegar esta feature: crea la cuenta de Victor (ya marcada como verificada, sin que él tenga que pasar por el flujo de registro/verificación de correo), y asigna `usuarioId` a todas las filas de `Factura` ya existentes.

**Rationale**: Distinto de una migración de esquema de Prisma (que solo cambia la estructura de las tablas) — esta necesita mover datos reales. Ejecutarlo como parte del despliegue de esta feature, no como una tarea manual aparte, es la única forma de cumplir FR-008 sin una ventana donde los datos existan "sin dueño" (Edge Cases del spec).

## Sources

- [Lucia-auth is Deprecated: Meet the Better Alternative – Better Auth](https://daily.dev/posts/g2sydesjx)
- [Self-hosted NodeJS Authentication in 2026 — Noorix Blog](https://www.noorix.com.au/blog/self-hosted-nodejs-authentication-comparison-2026/)
- [NestJS + BetterAuth: From Zero to Login (Prisma + Cookies)](https://medium.com/@andysenclave/nestjs-betterauth-part-1-from-zero-to-login-prisma-cookies-8bbd8d71e6d6)
- [Securing Multi-Tenant Applications Using Row Level Security in PostgreSQL with Prisma ORM](https://medium.com/@francolabuschagne90/securing-multi-tenant-applications-using-row-level-security-in-postgresql-with-prisma-orm-4237f4d4bd35)
- [NestJS + Prisma, transaction propagation & test rollback & multi-tenancy](https://blog.callgent.com/nestjs-prisma-transaction-propagation-test-rollback-multi-tenancy)
- [Best Transactional Email Platforms for 2026](https://maestra.io/blog/comparisons/best-transactional-email-platforms)
