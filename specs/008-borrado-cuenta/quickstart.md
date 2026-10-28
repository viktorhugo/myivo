# Quickstart: Borrado de Cuenta con Purga Diferida

## Prerrequisitos

- Stack local levantado (`docker compose up`, igual que `specs/007-despliegue-produccion`), con
  Postgres migrado y RLS aplicado.
- Una cuenta de prueba ya registrada con al menos una factura cargada (cualquier estado).

## Escenario 1 — Borrado y bloqueo inmediato (US1, FR-001 a FR-003)

1. Loguearse como la cuenta de prueba.
2. `POST /cuenta/eliminacion` con `{"correoConfirmacion": "<correo-real-de-la-cuenta>"}`.
3. **Esperado**: `200` con `eliminacionProgramadaPara` ~30 días adelante.
4. Repetir cualquier request previamente autenticada (ej. `GET /invoices`) con la misma cookie de
   sesión. **Esperado**: `403`, idéntico a no tener sesión.
5. Intentar loguearse de nuevo con las credenciales correctas. **Esperado**: las credenciales son
   válidas, pero `GET /invoices` (o cualquier endpoint de negocio) sigue devolviendo `403` — solo
   `GET /cuenta/eliminacion` y `POST /cuenta/eliminacion/cancelar` responden.

## Escenario 2 — Revertir dentro de la ventana (US2, FR-005)

1. Sobre la misma cuenta del Escenario 1, loguearse de nuevo.
2. `GET /cuenta/eliminacion`. **Esperado**: `200` con la `eliminacionProgramadaPara` vigente.
3. `POST /cuenta/eliminacion/cancelar`. **Esperado**: `200` con `eliminacionProgramadaPara: null`.
4. `GET /invoices`. **Esperado**: `200`, y la factura cargada antes del borrado sigue ahí, intacta
   (mismo `id`, mismo archivo original accesible vía `GET /invoices/:id/image`).

## Escenario 3 — Purga real tras vencer el plazo (US3, FR-006/FR-007/FR-008)

1. Repetir el Escenario 1 sobre una cuenta de prueba nueva.
2. Adelantar `eliminacionProgramadaPara` manualmente en la base de datos a una fecha ya pasada
   (simula el paso de 30 días sin correr un cron real de un mes).
3. Ejecutar el comando de purga (`node dist/scripts/purgar-cuentas-eliminadas.js` o equivalente,
   ver D4 en `research.md`).
4. **Esperado**: el archivo original en el volumen/filesystem ya no existe; `prisma.factura`
   para ese `usuarioId` devuelve 0 filas; `prisma.user.findUnique` para ese id devuelve `null`.
5. Repetir el comando de purga una segunda vez sobre el mismo estado. **Esperado**: no falla, no
   produce ningún efecto adicional (FR-010, idempotencia).
6. Intentar loguearse con las credenciales de la cuenta ya purgada. **Esperado**: mismo rechazo
   que un correo que nunca existió — ninguna respuesta distingue "nunca existió" de "fue purgada".

## Qué NO probar acá

- La decisión de proveedores sociales / Sign in with Apple — fuera de alcance de esta feature.
- El refactor de `apps/web` consumiendo `@myivo/domain` — fuera de alcance de esta feature.
- Confirmar el cron real en un VPS de producción — igual que el backup de specs/007, queda
  pendiente de que exista un VPS real (ver `PENDIENTES.md`); este quickstart valida el mecanismo,
  no la infraestructura operativa real.
