# Contrato: `GET /health`

Satisface FR-027 (US8) y FR-021/SC-006 (estado del último respaldo, reutilizando este mismo endpoint — research.md § 13).

## Estado actual

```ts
// apps/api/src/app.controller.ts
@Get('health')
health(): { status: 'ok' } {
  return { status: 'ok' };
}
```

No verifica la base de datos ni ninguna otra dependencia — siempre responde `ok` mientras el proceso Node esté vivo, incluso si Postgres está caída.

## Contrato nuevo

**Request**: `GET /health` — sin autenticación (US8: debe poder consultarse para diagnosticar, incluida la situación donde el login mismo esté roto). No debe filtrar ningún dato sensible (FR-028).

**Response 200** — todo saludable:

```json
{
  "status": "ok",
  "baseDeDatos": "ok",
  "ultimoRespaldo": {
    "fecha": "2026-08-10T03:00:12.000Z",
    "resultado": "ok"
  }
}
```

**Response 200 con degradación parcial** — el endpoint sigue respondiendo 200 (el proceso HTTP en sí está vivo) pero refleja el problema en el cuerpo, para que se pueda diferenciar "la API no responde" de "la API responde pero algo detrás está mal":

```json
{
  "status": "ok",
  "baseDeDatos": "error",
  "ultimoRespaldo": {
    "fecha": "2026-08-09T03:00:05.000Z",
    "resultado": "fallido",
    "mensaje": "el backup quedó vacío"
  }
}
```

Si `backups/ultimo-estado.json` todavía no existe (nunca corrió un respaldo, p. ej. instalación recién hecha), `ultimoRespaldo` es `null` — no es un error, es un estado inicial legítimo.

## Reglas

- **FR-027**: `baseDeDatos` se calcula con una consulta trivial y barata (`SELECT 1`) contra Prisma — nunca una consulta que dependa de RLS/`app.usuario_id` (este endpoint no tiene sesión de usuario).
- **FR-028**: el cuerpo de la respuesta MUST NOT incluir stack traces, connection strings, ni el contenido de `mensaje` de un fallo de respaldo si ese mensaje pudiera contener una ruta de archivo sensible o un secreto — el script de respaldo debe producir mensajes de error ya sanitizados antes de escribirlos en `ultimo-estado.json`.
- El endpoint sigue siendo público (sin `SessionUsuarioGuard`) — es la herramienta de diagnóstico cuando algo más ya está roto (US8).
