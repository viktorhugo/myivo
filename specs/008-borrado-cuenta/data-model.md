# Data Model: Borrado de Cuenta con Purga Diferida

## `User` — campos nuevos

| Campo | Tipo | Default | Notas |
|---|---|---|---|
| `eliminacionSolicitadaEn` | `DateTime?` | `null` | Momento en que se confirmó el borrado por última vez. No se limpia al cancelar — queda como historial auditable (FR-012). |
| `eliminacionProgramadaPara` | `DateTime?` | `null` | Fecha de purga definitiva vigente (`eliminacionSolicitadaEn` + 30 días). `null` = cuenta activa, sin eliminación en curso. Se limpia al cancelar (D3). Es el único campo que `SessionUsuarioGuard` consulta (D2) y que el comando de purga usa para seleccionar candidatos (D4/D6). |

No se agrega ningún estado nuevo a la máquina de estados de `Factura` (`factura-estado.ts`) — el
borrado de cuenta es ortogonal al pipeline de extracción, igual que `eliminadaEn` ya lo es
(constitution, Máquina de Estados del Documento: los estados del documento MUST vivir en un único
lugar del dominio; esta feature no le agrega transiciones).

## Reglas de validación e invariantes

- `eliminacionProgramadaPara` solo puede fijarse si estaba en `null` (FR-011: una solicitud sobre
  una cuenta que ya tiene eliminación programada no reinicia el plazo ni crea una segunda purga).
- `eliminacionSolicitadaEn` y `eliminacionProgramadaPara` se escriben siempre juntos, en la misma
  operación, nunca uno sin el otro.
- Mientras `eliminacionProgramadaPara` no sea `null`, ninguna otra escritura de negocio (subir
  factura, editar campos, confirmar duplicados, etc.) MUST poder ejecutarse para ese `usuarioId` —
  lo garantiza `SessionUsuarioGuard` (D2), no una validación por endpoint.
- El comando de purga solo selecciona `User` donde `eliminacionProgramadaPara <= now()` — nunca
  antes de esa fecha, sin excepción manual.

## Entidades conceptuales (de `spec.md` § Key Entities, mapeadas a lo anterior)

- **Eliminación programada** = el `User` con `eliminacionProgramadaPara` no nulo. No es una
  entidad propia en base de datos; es un estado derivado de esos dos campos sobre `User`.
- **Purga** = la ejecución del comando de D4/D5 sobre un `User` candidato: borra archivos
  (originales + derivados de todas sus Facturas vía `FileStorageService`), borra sus `Factura`, y
  finalmente borra el `User` (lo que a su vez cascadea sobre `Session`/`Account`/`Passkey`/
  `TwoFactor`, todas tablas propias de Better Auth con `onDelete: Cascade` hacia `User`).

## Qué NO cambia

- `Factura.eliminadaEn` (soft-delete por factura individual) sigue exactamente igual — esta
  feature no lo toca, ni en comportamiento ni en constitution (Principio I sigue exigiendo
  soft-delete puro y recuperable para ese caso, sin la excepción nueva).
- `Factura.usuarioId` sigue sin `onDelete: Cascade` (D5, deliberado) — la purga borra las Facturas
  explícitamente antes del `User`, nunca depende de una cascada automática a nivel de esquema.
