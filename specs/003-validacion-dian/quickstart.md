# Quickstart: Validación end-to-end por historia de usuario

Guía de validación manual, no de implementación. Prerrequisitos comunes: ver `specs/001-captura-facturas/quickstart.md` (sesión autenticada, `docker compose up`), y al menos una factura ya capturada con CUFE no nulo (feature 001 — un tiquete POS sin CUFE no sirve para P1).

## P1 — Validación asistida de un documento individual

**Objetivo**: demostrar que el sistema nunca automatiza la consulta a la DIAN, y que el resultado que el usuario reporta queda guardado con trazabilidad completa.

1. Abrir el Detalle de una factura con CUFE no nulo — confirmar que se ofrece la acción de validación DIAN (Acceptance Scenario 1).
2. Abrir una factura **sin** CUFE (p. ej. un tiquete POS) — confirmar que la acción de validación DIAN **no** aparece (Acceptance Scenario 4, FR-005).
3. Desde la factura con CUFE, confirmar que el enlace generado apunta a `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey={el CUFE exacto de esa factura}` (research.md § 1).
4. Abrir ese enlace en una pestaña nueva y confirmar manualmente en el portal de la DIAN qué dice sobre ese documento (fuera de la app — esto es exactamente el punto: el sistema no lo hace por ti).
5. Volver a la app y registrar el resultado observado, eligiendo una de las cuatro opciones del enum (Acceptance Scenario 2).
6. Confirmar que el Detalle de esa factura ahora muestra el resultado registrado, con su fecha.
7. Ir al Listado y confirmar que esa factura se distingue visualmente de una que nunca se validó (Acceptance Scenario 3, FR-006).
8. Repetir el registro sobre la misma factura con un resultado distinto — confirmar que ambos registros conviven en el historial (nunca se sobrescribe uno con otro — Acceptance Scenario 5, data-model.md "append-only").

```bash
curl -b cookies.txt -X POST https://localhost/invoices/:id/validaciones-dian \
  -H "Content-Type: application/json" \
  -d '{"resultado": "valido_vigente"}'
```

**Resultado esperado**: `201` con la `ValidacionDian` creada, incluyendo el snapshot de los datos de la factura en ese momento. Repetir `GET /invoices/:id/validaciones-dian` y confirmar que el array incluye este registro.

## P2 — Conciliación en lote

**Prerrequisito real**: un archivo `.xlsx` descargado del portal "Facturando Electrónicamente" de la DIAN (sección de documentos recibidos) que contenga el CUFE de al menos una factura ya capturada en el sistema. **Nota**: el esquema exacto de columnas de ese archivo no se confirmó durante `/speckit-plan` (research.md § 3) — si el parser falla contra un archivo real la primera vez, ese es precisamente el caso que este quickstart existe para detectar antes de dar la historia por completa.

```bash
curl -b cookies.txt -X POST https://localhost/invoices/dian-conciliacion \
  -F "archivo=@./documentos-recibidos-dian.xlsx"
```

**Resultado esperado**: `200` con `{ facturasConciliadas: N, cufesSinCoincidencia: M }`. Confirmar en el Detalle de cada factura conciliada que aparece una nueva `ValidacionDian` con `metodo: "conciliacion"` (Acceptance Scenario 1).

**Validar el caso sin coincidencias**: subir un archivo `.xlsx` válido pero sin ningún CUFE de una factura existente — confirmar `facturasConciliadas: 0` sin ningún error de servidor (Acceptance Scenario 2).

**Validar el rechazo de formato inválido**: subir un archivo que no sea `.xlsx` (p. ej. un `.txt` cualquiera) — confirmar `400` con un mensaje claro, no un error genérico de servidor (Acceptance Scenario 3, FR-009).

## Validar que nada se rompió

Repetir los escenarios de aceptación de `specs/001-captura-facturas/quickstart.md` y `specs/002-rediseno-visual-web/quickstart.md` — clasificación, elegibilidad, duplicados, filtros, temas visuales deben comportarse exactamente igual que antes de esta feature. En particular, confirmar que `elegibilidadTributaria` de una factura no cambia por el solo hecho de registrar una `ValidacionDian` sobre ella (constitution Principio IV, data-model.md).
