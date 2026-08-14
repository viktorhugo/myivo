# Contrato: Respaldo y restauración (`scripts/backup-db.sh`, `scripts/restore.sh`)

US5 se prueba end-to-end a través de estos dos scripts — este es su contrato de entrada/salida/código de retorno, no solo su descripción narrativa.

## `scripts/backup-db.sh` (extiende el existente, mismo archivo)

**Ya existe y no cambia**: `pg_dump` vía `docker compose exec -T postgres`, gzip, escritura en `backups/`, falla ruidosa si el dump queda vacío, rotación local por `MYIVO_BACKUP_RETENCION_DIAS` (default 14).

**Se agrega, en orden, dentro del mismo script**:

1. Empaquetar las imágenes: `docker compose exec -T api tar -czf - -C "$IMAGE_STORAGE_PATH" .` (mismo patrón que el `pg_dump` ya existente — el mismo comando que ya usa la propia app para leer ese path) → `backups/myivo-<timestamp>-imagenes.tar.gz`.
2. Combinar el dump de BD + el tar de imágenes en un único paquete: `backups/myivo-<timestamp>.tar`.
3. Cifrar con `age` usando `MYIVO_BACKUP_ENCRYPTION_KEY` → `backups/myivo-<timestamp>.tar.age`. El `.tar` sin cifrar intermedio se borra de inmediato tras un cifrado exitoso — nunca queda un artefacto sin cifrar en disco más tiempo del necesario para producir el cifrado.
4. Subir con `rclone copy` a `MYIVO_BACKUP_REMOTE`.
5. Escribir `backups/ultimo-estado.json`.

**Exit codes**:

| Código | Significado | Efecto en `ultimo-estado.json` |
|---|---|---|
| `0` | Dump + imágenes + cifrado + subida, los 4 pasos completos. | `{"resultado": "ok", "fecha": "<ahora>"}` |
| `≠0` | Cualquier paso falló (dump vacío, `age`/`rclone` no instalado, credenciales de `rclone` inválidas, subida interrumpida). | `{"resultado": "fallido", "fecha": "<ahora>", "mensaje": "<motivo, sin secretos>"}` |

En cualquier fallo, el script MUST salir distinto de 0 (cron ya lo reporta por su propio mecanismo de correo-en-stderr, documentado en el propio script) y MUST dejar escrito el estado de fallo — nunca terminar en silencio ni con un archivo `.age` a medio subir presentado como éxito.

**No side effects si falla temprano**: si `MYIVO_BACKUP_ENCRYPTION_KEY`/`MYIVO_BACKUP_REMOTE` no están configuradas, el script MUST salir antes de generar cualquier archivo — nunca dejar un `.sql.gz`/`.tar` sin cifrar como único resultado de la corrida (ver contracts/env-vars.md).

## `scripts/restore.sh` (nuevo)

**Invocación**: `./scripts/restore.sh <ruta-o-nombre-de-archivo-de-respaldo>` — acepta un archivo local en `backups/` o un nombre para descargar desde `MYIVO_BACKUP_REMOTE` vía `rclone copy` si no existe localmente.

**Precondición de seguridad** (responde al Edge Case del spec "¿qué pasa si se restaura sobre un servidor que ya tiene datos?"): el script MUST verificar que la base de datos destino esté vacía (p. ej. `SELECT COUNT(*) FROM facturas` — si la tabla no existe todavía o da error, se asume limpia) antes de restaurar. Si ya tiene datos, el script se detiene con un mensaje explícito y exige un flag `--forzar` explícito para continuar — nunca sobrescribe datos existentes por defecto (consistente con el Principio I: ni siquiera una restauración puede pisar evidencia existente sin una confirmación explícita).

**Pasos**: descargar (si aplica) → descifrar con `age -d` usando `MYIVO_BACKUP_ENCRYPTION_KEY` → destar → `psql` restaura el `.sql.gz` → las imágenes se copian al volumen `invoice_images` (vía `docker compose cp`/equivalente, montado en el contenedor `api`).

**Exit codes**:

| Código | Significado |
|---|---|
| `0` | Restauración completa — BD e imágenes coinciden con el respaldo elegido. |
| `1` | Precondición de seguridad falló (destino no vacío, sin `--forzar`). |
| `≠0, ≠1` | Fallo técnico (descarga, descifrado con llave incorrecta, `psql` con error). |

**Salida esperada en éxito**: un mensaje final explícito con el conteo de facturas restauradas, para que el paso de verificación del quickstart tenga algo concreto que comparar contra el origen (SC-005: "el 100% de las facturas... quedan disponibles e idénticas").

**FR-020** exige que este procedimiento se haya ejecutado al menos una vez de principio a fin antes de darse por completo — ver quickstart.md, sección de restauración, que es literalmente la ejecución de este contrato contra un entorno limpio.
