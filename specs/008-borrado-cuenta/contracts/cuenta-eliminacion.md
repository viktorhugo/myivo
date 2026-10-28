# Contrato: Borrado de cuenta

Mismo patrón que `apps/api/src/modules/auth/cuenta.controller.ts`: protegido por
`SessionUsuarioGuard`, `usuarioId` resuelto vía `@UsuarioId()`, sin body libre de identificadores.

## `POST /cuenta/eliminacion`

Inicia el borrado. Requiere confirmación deliberada (FR-002) — el body exige repetir el correo de
la cuenta como gesto de confirmación explícita, no un booleano `{confirmar: true}` trivial de
automatizar por error.

**Request**:
```json
{ "correoConfirmacion": "usuario@ejemplo.com" }
```

**Responses**:
- `200` — `{ "eliminacionProgramadaPara": "2026-11-26T00:00:00.000Z" }`. Efecto: fija
  `eliminacionSolicitadaEn`/`eliminacionProgramadaPara`, revoca todas las sesiones activas de la
  cuenta (incluida la que hizo esta misma request — el cliente queda sin sesión al recibir la
  respuesta).
- `400` — `correoConfirmacion` no coincide con el correo real de la cuenta.
- `409` — la cuenta ya tiene una eliminación programada (FR-011); `details.eliminacionProgramadaPara`
  en el body de error (convención ya existente del `GlobalExceptionFilter` para campos extra junto
  a `message`) trae la fecha vigente para que el cliente pueda redirigir a la pantalla de estado.

## `GET /cuenta/eliminacion`

Único endpoint de negocio que una cuenta con eliminación programada puede llamar (junto con el de
cancelar, abajo) — ver D2/D3. Útil tanto para una cuenta activa (confirma que no hay nada
pendiente) como para la pantalla de "tu cuenta está programada para eliminación".

**Response `200`** (cuenta activa): `{ "eliminacionProgramadaPara": null }`

**Response `200`** (cuenta con eliminación programada):
```json
{ "eliminacionProgramadaPara": "2026-11-26T00:00:00.000Z", "eliminacionSolicitadaEn": "2026-10-27T00:00:00.000Z" }
```

## `POST /cuenta/eliminacion/cancelar`

Revierte una eliminación programada (FR-005/US2). Sin body.

**Responses**:
- `200` — `{ "eliminacionProgramadaPara": null }`. Efecto: limpia `eliminacionProgramadaPara`
  (`eliminacionSolicitadaEn` se conserva como historial — D7). La cuenta vuelve a operar normal de
  inmediato, sin pérdida de datos.
- `409` — la cuenta no tiene ninguna eliminación programada para cancelar.

## Comportamiento transversal (no un endpoint — ver D2)

Mientras `eliminacionProgramadaPara` no sea `null`, **todo otro endpoint de la API** (facturas,
reportes, conciliación DIAN, identificaciones) responde `403` para esa sesión, idéntico a una
sesión inexistente — nunca revela que la cuenta existe o está en proceso de eliminación (FR-008
aplica también acá, no solo a una cuenta ya purgada).

## Comando de purga (no HTTP — operación interna, D4)

No expone contrato HTTP. Es un comando standalone de Nest, invocado por cron del sistema
operativo una vez al día, documentado junto al cron de backup existente en `README.md`. Ver D4-D6
en `research.md` para su contrato de comportamiento (selección de candidatos, orden de
operaciones, idempotencia).
