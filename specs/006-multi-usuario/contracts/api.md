# API Contract: Registro abierto con aislamiento total entre usuarios

Extiende `specs/001-captura-facturas/contracts/api.md` y los contratos de las features 002-005 — esta feature reemplaza los endpoints de autenticación existentes y modifica el **comportamiento** (no la forma) de todos los endpoints que ya devuelven o agregan datos de `Factura`.

## Autenticación — reemplaza `apps/api/src/modules/auth/` actual

Better Auth expone su propio conjunto de rutas bajo un prefijo (p. ej. `/api/auth/*`) — no se documentan aquí endpoint por endpoint porque son responsabilidad de la librería (research.md § 1), pero deben cubrir, como mínimo:

| Operación | Reemplaza |
|---|---|
| Registro (correo + contraseña) | No existía — nuevo (FR-001) |
| Verificación de correo | No existía — nuevo (FR-002) |
| Inicio de sesión | `POST /auth/login` actual (`auth.controller.ts`) |
| Cierre de sesión | `POST /auth/logout` actual |
| Cambio de contraseña propia | No existía — nuevo (FR-009, US2) |

El guard actual (`SessionAuthGuard`) se reemplaza por uno equivalente que además expone el `usuarioId` de la sesión a cada request (`session-usuario.guard.ts`, plan.md § Project Structure) — todo endpoint ya protegido hoy sigue protegido igual, más el `usuarioId` disponible para acotar consultas.

## Identificaciones tributarias propias (US2, FR-007) — endpoint nuevo

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/cuenta/identificaciones` | Devuelve las identificaciones tributarias configuradas para la cuenta de la sesión actual. |
| `PUT` | `/cuenta/identificaciones` | Reemplaza la lista completa (mismo criterio que hoy `MIS_IDENTIFICACIONES`: una lista, no un solo valor). Efecto inmediato en la próxima evaluación de elegibilidad (Acceptance Scenario 2 de US2) — no requiere reiniciar nada, a diferencia de la variable de entorno que reemplaza. |

## Comportamiento modificado en endpoints existentes (FR-004, FR-005)

Todo endpoint que hoy devuelve, cuenta, o suma datos de `Factura` (`GET /invoices`, `GET /invoices/:id`, `GET /invoices/duplicates/pending`, los de `validacion-dian`, los de `reportes/anual`) queda acotado al `usuarioId` de la sesión — **sin cambiar la forma de su respuesta**, solo su contenido (ahora implícitamente filtrado). Acceder a un identificador que pertenece a otra cuenta responde exactamente igual que un identificador inexistente (FR-005) — el código de estado exacto (404 en todos los casos, ya sea "no existe" o "existe pero no es tuyo") se define al implementar, sin ninguna diferencia observable entre ambos casos.

## Conciliación DIAN en lote y reporte anual (FR-006, US1 Acceptance Scenarios 4 y 5)

`POST /invoices/dian-conciliacion` y `GET /reportes/anual` ya toman implícitamente el `usuarioId` de la sesión para acotar qué facturas concilian o reportan — sin ningún parámetro nuevo en la petición, el aislamiento es transparente al cliente.
