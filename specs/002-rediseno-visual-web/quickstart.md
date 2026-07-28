# Quickstart: Validación end-to-end por historia de usuario

Guía de validación manual, no de implementación. Cada bloque corresponde a una historia del spec y se ejecuta en el orden de entrega (P1 → P5); cada uno asume que el anterior ya está construido y validado. Prerrequisitos comunes: ver `specs/001-captura-facturas/quickstart.md` (sesión autenticada, `docker compose up`).

## P1 — Sistema de diseño visual con dos temas

**Objetivo**: demostrar que ambos temas se aplican de forma completa y consistente sobre Captura, Detalle y Listado, sin afectar ninguna funcionalidad existente.

1. Abrir la app sin haber elegido tema antes — confirmar que se aplica Industry o Nocturne según la preferencia de color del sistema operativo/navegador (spec Scenario 1).
2. Cambiar el tema manualmente desde el selector — confirmar que el cambio se aplica de inmediato en toda la app, sin recargar ni perder el estado de la pantalla actual (Scenario 2).
3. Recargar la página — confirmar que la preferencia manual persiste (FR-003).
4. Con Industry activo, revisar Captura: tarjetas como dibujos de línea sin relleno, esquinas cuadradas, marcas de registro en las 4 esquinas; botón primario como único elemento sólido (Scenario 3).
5. Con Nocturne activo, revisar la misma pantalla: tarjetas con relleno de superficie, radios de 8px, separadores como degradados, botón primario como contorno (Scenario 4).
6. En Detalle de una factura ya extraída, confirmar puntos de confianza por campo, banner de elegibilidad con el motivo correcto, y (si corregiste algún campo antes) el badge "Corregido" con el valor original tachado (Scenario 5).
7. En Listado, aplicar filtros y confirmar que el total agregado recalcula en vivo; si tienes una factura en moneda distinta a COP, confirmar el badge de moneda y la etiqueta "Fuera del total en COP" (Scenario 6).
8. **Validar que nada se rompió**: repetir los escenarios de aceptación de `specs/001-captura-facturas/quickstart.md` (H2-H5) y confirmar que ningún resultado cambió — clasificación, elegibilidad, duplicados, filtros deben comportarse exactamente igual que antes del rediseño (SC-004).

## P2 — Eliminar factura (soft-delete)

**Prerrequisito**: al menos una factura existente (cualquier estado).

```bash
curl -b cookies.txt -X POST https://localhost/invoices/:id/delete
```

**Resultado esperado**: `200` con la factura marcada. Repetir `GET /invoices/:id` sobre el mismo id y confirmar `404` (Contract: comportamiento equivalente a "no encontrado"). Confirmar en el listado (`GET /invoices`) que ya no aparece ni en `items` ni afecta `conteo`/`sumaTotal` (Scenario 1).

**Validar que no hay purga automática**: no hay acción a ejecutar aquí — el criterio es negativo (FR-009): confirmar directamente en la base de datos que el registro y el archivo de imagen siguen existiendo, sin ningún job ni proceso que los borre (Scenario 2).

**Validar confirmación explícita**: desde la UI, abrir el menú "···" en Detalle y confirmar que "Eliminar factura" exige una confirmación antes de ejecutar la acción (Scenario 3).

**Validar idempotencia**: repetir la misma llamada `POST /invoices/:id/delete` sobre un id ya eliminado — confirmar `404` sin error de servidor ni estado inconsistente (Edge Case).

## P3 — Detección de varias facturas en una foto

**Prerrequisito**: una foto real que contenga visiblemente dos documentos de compra distintos.

```bash
curl -b cookies.txt -X POST https://localhost/invoices -F "files=@./dos-facturas-en-una-foto.jpg"
```

**Resultado esperado tras el procesamiento asíncrono**: `GET /invoices/:id` devuelve `estado: "varias_facturas"`, con todos los campos extraídos (`comercioNombre`, `totalCentavos`, `items`, etc.) en su valor vacío/nulo — ningún dato mezclado de ambos documentos (Scenario 1).

**Validar la acción de recaptura**: en la UI, confirmar que la foto marcada ofrece "Separar y recapturar", y que al usarla el sistema no reutiliza ni conserva ningún dato de la foto original (Scenario 2).

**Validar el caso normal**: subir una foto de un solo documento y confirmar que no se marca falsamente como `varias_facturas` (Scenario 3 — aceptando que la detección es best-effort).

## P4 — Pantalla de estado vacío

**Prerrequisito**: una cuenta sin ninguna factura registrada (o todas eliminadas vía P2).

**Resultado esperado**: al abrir el Listado, se muestra la pantalla de estado vacío (ícono, copy, botón primario) en vez de una tabla vacía (Scenario 1). Tocar el botón primario lleva directo a Captura (Scenario 2).

## P5 — Refinamiento visual de confirmación de duplicado

**Prerrequisito**: el flujo de detección de duplicados de `specs/001-captura-facturas` funcionando (H5).

Provocar un duplicado probable (dos facturas sin CUFE confiable, mismo comercio/fecha/total) y confirmar en `GET /invoices/duplicates/pending` que la marca aparece; en la UI, confirmar que el bottom sheet resultante usa los tokens visuales del tema activo (Scenario 1) y que resolver como "distinto" o "es la misma" sigue funcionando exactamente igual que antes del rediseño (Scenario 2).
