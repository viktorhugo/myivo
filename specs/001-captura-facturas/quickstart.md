# Quickstart: Validación end-to-end por historia de usuario

Guía de validación manual, no de implementación. Cada bloque corresponde a una historia del spec y se ejecuta en el orden de entrega (H1 → H2 → H3 → H4 → H5); cada uno asume que el anterior ya está construido y validado.

## Prerrequisitos comunes

```bash
docker compose up -d          # levanta apps/api, apps/web, PostgreSQL, Caddy
curl -c cookies.txt -X POST https://localhost/auth/login \
  -d '{"usuario": "...", "contraseña": "..."}'   # sesión de un solo usuario (FR-030)
```

Todas las llamadas posteriores usan `-b cookies.txt`.

## H1 — Capturar una factura (P1)

**Objetivo**: demostrar que la foto se guarda de inmediato, con estado visible, sin depender de ningún procesamiento posterior.

```bash
curl -b cookies.txt -X POST https://localhost/invoices \
  -F "files=@./factura1.jpg" -F "files=@./factura2.jpg"
```

**Resultado esperado**: `201` con dos `Factura`, cada una `estado: "recibida"`, cada una con su propio `id`. Repetir `GET /invoices/:id/image` para cada una y confirmar que el byte-stream devuelto coincide con el archivo subido — sin ninguna extracción corriendo todavía (referencia: [spec.md](./spec.md) User Story 1, Acceptance Scenarios 1-2).

**Caso de fallo simulado**: detener el worker/proceso de extracción (si ya existe) o subir una imagen corrupta; `GET /invoices/:id` debe seguir devolviendo la imagen original y un `estado` que refleje el fallo (`fallida`), nunca una pérdida del archivo (Acceptance Scenario 3).

## H2 — Extracción automática de datos (P2)

**Prerrequisito**: al menos una `Factura` en `recibida` de H1.

**Resultado esperado tras el procesamiento asíncrono**: `GET /invoices/:id` devuelve comercio, NIT, fecha/hora, ítems, subtotal, IVA por tarifa, impuesto al consumo, propina, total, medio de pago y datos del adquiriente cuando estaban visibles en la foto, cada uno con su `confianzaCampos` (spec User Story 2, Scenario 1).

**Validar CUFE por QR**: usar una foto con QR de factura electrónica legible; confirmar que `cufe` está poblado y `cufeOrigen: "qr"` (Scenario 2).

**Validar descuadre**: usar una foto donde `subtotal + IVA + propina ≠ total`; confirmar `estado: "necesita_revisión"` en vez de un total "corregido" silenciosamente (Scenario 3).

**Validar corrección manual**:

```bash
curl -b cookies.txt -X PATCH https://localhost/invoices/:id/fields \
  -d '{"campo": "total", "valorCorregido": "1234500"}'
```

Confirmar que `GET /invoices/:id` muestra tanto el valor extraído original como el corregido, diferenciados (Scenario 5; `data-model.md` → Corrección Manual).

## H3 — Clasificación tributaria y elegibilidad (P3)

**Prerrequisito**: una `Factura` ya en `extraída` de H2.

Probar las cuatro combinaciones de Acceptance Scenarios del spec (User Story 3):

1. CUFE válido + identificación del usuario + medio de pago electrónico → `elegibilidadTributaria: true`.
2. Tiquete POS sin CUFE → `elegibilidadTributaria: false`, `elegibilidadMotivo: "es tiquete POS"`.
3. Factura electrónica a nombre distinto → `elegibilidadMotivo: "no está a tu nombre"`.
4. Factura electrónica pagada en efectivo → `elegibilidadMotivo: "pago en efectivo"`.

**Validar recálculo**: corregir `medioPago` de `efectivo` a `transferencia_pse` vía `PATCH /invoices/:id/fields` y confirmar que `elegibilidadTributaria` cambia automáticamente, sin ningún endpoint que permita fijarlo a mano (Scenario 5).

## H4 — Consulta y filtrado de facturas (P4)

**Prerrequisito**: varias facturas de H1-H3 en distintos estados y con distinta elegibilidad.

```bash
curl -b cookies.txt "https://localhost/invoices?fechaDesde=2026-01-01&fechaHasta=2026-12-31&elegibilidad=true"
```

**Resultado esperado**: `items` filtrados según los criterios activos combinados, más `conteo` y `sumaTotal` del subconjunto filtrado (Scenario 1-2). Repetir con distintos filtros (comercio, monto, tipo de documento, estado) y confirmar que se combinan con AND.

**Validar la pregunta del MVP**: filtrar por año en curso + `elegibilidad=true` y confirmar que `sumaTotal` responde directamente "¿cuánto llevo este año en compras elegibles?" sin sumar manualmente (Scenario 4; SC-003 del spec).

**Detalle**: `GET /invoices/:id` muestra todos los campos junto a la imagen original (Scenario 3).

## H5 — Detección de duplicados (P5)

**Prerrequisito**: el flujo de captura + extracción de H1-H2 funcionando.

**Duplicado exacto**: subir dos fotos con el mismo CUFE. Confirmar que la segunda queda marcada automáticamente sin preguntar (`MarcaDePosibleDuplicado.metodoDeteccion: "cufe_exacto"`, `estado: "duplicado_confirmado"`) — Scenario 1.

**Duplicado probable**: subir dos fotos sin CUFE, mismo comercio (con variación menor de OCR en el nombre), misma fecha, mismo total.

```bash
curl -b cookies.txt https://localhost/invoices/duplicates/pending
curl -b cookies.txt -X POST https://localhost/invoices/duplicates/:id/resolve \
  -d '{"resolucion": "distinto"}'
```

Confirmar que aparece en `pendiente_confirmacion` (Scenario 2) y que, tras resolver como `"distinto"`, ambas facturas quedan como registros independientes sin volver a preguntar por esa combinación (Scenario 3).

**Validar que no bloquea el lote**: subir un lote de 3+ fotos donde una es duplicado exacto de otra ya existente; confirmar que las demás del lote se procesan con normalidad (Scenario 4; FR-021).
