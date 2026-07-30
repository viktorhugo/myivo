# Quickstart: Validación end-to-end por historia de usuario

Guía de validación manual, no de implementación. Prerrequisitos comunes: ver `specs/001-captura-facturas/quickstart.md` (sesión autenticada, `docker compose up`). Además: un PDF real de una factura electrónica colombiana (descargado de un correo, no impreso ni escaneado) — idealmente uno con el CUFE/código QR visible en el documento, para validar el camino preferido de extracción.

## P1 — Subir un PDF y que quede capturado de inmediato

**Objetivo**: demostrar que un PDF se captura por el mismo flujo que una foto, sin depender de que la extracción funcione.

1. Abrir la pantalla de captura ya existente — confirmar que el selector de archivo acepta un PDF, no solo imágenes (Acceptance Scenario 1, FR-001).
2. Subir el PDF de una factura electrónica real — confirmar que aparece de inmediato en el Listado con su propio estado, igual que ya ocurre con una foto (Acceptance Scenario 2, FR-002).
3. Subir varios PDFs a la vez — confirmar que todos se aceptan en una sola operación (Acceptance Scenario 3, FR-003).
4. Desde el Detalle de la factura capturada, pedir ver/descargar el archivo original — confirmar que es exactamente el mismo PDF que se subió, sin ninguna modificación (Acceptance Scenario 4, FR-004, constitution Principio I).
5. Confirmar que el Detalle/Listado muestran una vista previa navegable del PDF (no solo un ícono genérico ni la obligación de descargar para verlo) — FR-005.

```bash
curl -b cookies.txt -X POST https://localhost/invoices \
  -F "files=@./factura-electronica.pdf"
```

**Resultado esperado**: `201` con la `Factura` creada, `estado: "recibida"` (o ya `"procesando"` si el despacho async fue inmediato) — misma forma de respuesta que subir una foto (contracts/api.md).

## P2 — Extracción y clasificación del PDF

**Prerrequisito real**: el mismo PDF de P1, ya capturado.

1. Esperar a que el procesamiento termine (o consultar el Detalle tras unos segundos) — confirmar que se extrajeron los mismos campos que extraería una foto nítida equivalente: comercio, fecha, montos, ítems (Acceptance Scenario 1, FR-006).
2. Si el PDF tiene el QR de la DIAN renderizado visualmente, confirmar que el CUFE quedó poblado y que su origen es `qr` (no el respaldo de texto impreso) — Acceptance Scenario 2, FR-007, constitution Principio III.
3. Confirmar que la elegibilidad tributaria de esa factura se calculó con la misma regla ya existente (feature 001) — comparar contra una foto de una compra equivalente si es posible (Acceptance Scenario 3, FR-009).
4. Subir un PDF corrupto o renombrado (un archivo `.pdf` que en realidad no es un PDF válido) — confirmar que la factura queda en `extraction_failed`, disponible para reintento, sin bloquear la captura de nada más (Acceptance Scenario 4, FR-008).

**Validar el edge case de duplicado cross-canal** (Clarifications, sesión 2026-07-29): capturar primero una foto de un recibo físico y, después, el PDF de la factura electrónica de esa misma compra (mismo comercio/fecha/total) — confirmar que el sistema lo marca como "posible duplicado" con el mismo criterio ya existente (feature 001/002), sin ningún tratamiento especial por ser un PDF.

## Validar que nada se rompió

Repetir los escenarios de aceptación de `specs/001-captura-facturas/quickstart.md` (captura, extracción, clasificación, duplicados) subiendo una foto normal — deben comportarse exactamente igual que antes de esta feature. En particular, confirmar que ningún adaptador de extracción (Claude/OpenAI/Gemini/OpenAI-compatible) ni el decodificador de CUFE cambiaron su comportamiento para una foto (research.md § 2: cero cambios a esos archivos).
