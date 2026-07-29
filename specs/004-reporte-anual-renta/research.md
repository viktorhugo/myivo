# Research: Reporte anual de compras elegibles para renta

## 1. Librería de generación de PDF (US2, FR-010)

**Decision**: `pdfmake`.

**Rationale**: El reporte necesita exactamente dos cosas en el PDF — un bloque de resumen (total, conteo, desglose mensual) y una tabla con una fila por factura elegible (spec.md § Clarifications, sesión 2026-07-28). `pdfmake` genera PDFs a partir de una estructura declarativa (JSON-like), con soporte de tablas de primera clase — mucho más simple para este caso que dibujar cada celda manualmente. No depende de un navegador headless (a diferencia de Puppeteer/Playwright, que requieren descargar un binario de Chromium de 150-400MB), consistente con el objetivo de costo operativo bajo en un VPS pequeño (constitution Principio VII).

**Alternatives considered**:
- `pdfkit`: igual de ligero y sin dependencia de browser, pero usa una API tipo canvas donde cada elemento (incluidas las celdas de una tabla) se posiciona a mano — más control, pero más código para este caso concreto de "resumen + tabla".
- Puppeteer/Playwright (HTML a PDF vía Chromium headless): descartado — el peso del binario y el consumo de RAM/CPU de un browser headless no encajan con un VPS de 1-2GB RAM y el objetivo de <15 USD/mes ya establecido para el proyecto.

## 2. Librería de generación de Excel (US2, FR-010)

**Decision**: reusar `exceljs`, ya instalado desde `specs/003-validacion-dian` (conciliación en lote).

**Rationale**: Sin dependencia nueva. `exceljs` ya se usa en este proyecto para *leer* un `.xlsx`; generar uno (escribir hojas, filas, formato de celda) es la misma API, solo en la dirección contraria (`workbook.xlsx.writeBuffer()` en vez de `.load()`).

## 3. Cálculo del desglose mensual y el total anual

**Decision**: Reutilizar la misma consulta de `FacturaRepository` que ya calcula `sumaTotal` para el Listado (`specs/001-captura-facturas`), acotada por rango de fechas del año elegido (`fechaHoraCompra` entre el 1 de enero y el 31 de diciembre de ese año) y `elegibilidadTributaria: true`, agrupando en memoria por mes a partir de los resultados — no se necesita una consulta SQL de agregación por mes aparte, dado el volumen esperado (backlog personal, no miles de registros por año).

**Rationale**: Coherente con el patrón ya establecido (FR-027 de la feature 001: el total agregado solo incluye documentos en COP) — el reporte reutiliza exactamente esa misma regla de "qué cuenta como elegible en el total", sin reinventar el filtro. Agrupar en memoria evita una consulta SQL más compleja (`GROUP BY EXTRACT(MONTH FROM ...)`) para un volumen de datos que no lo justifica — un usuario que "acumula facturas físicas" (spec.md de 001) no genera miles de filas por año.

**Alternatives considered**: Agregación por mes directamente en SQL (`Prisma.$queryRaw` con `EXTRACT(MONTH FROM ...)`, mismo patrón ya usado en `duplicate-matching.service.ts` para la búsqueda difusa) — más eficiente a gran escala, pero una complejidad innecesaria para el volumen real de este sistema de un solo usuario; se puede migrar a esto después si el volumen lo justifica, sin cambiar el contrato de la API.

## 4. Qué años ofrecer para elegir

**Decision**: El rango de años seleccionables se deriva de los datos reales — el año más antiguo con al menos una factura capturada (elegible o no, para no ocultar el límite real del historial) hasta el año en curso.

**Rationale**: Evita una lista fija de años hardcodeada que quedaría desactualizada, y evita ofrecer años sin ningún dato en absoluto (ruido en el selector). Consistente con el Edge Case ya documentado en spec.md (un año sin compras elegibles se muestra igual, con $0 — pero eso es distinto de un año donde el usuario ni siquiera tenía la app en uso).

## Sources

- [Top JavaScript PDF generator libraries for 2026 (Nutrient)](https://www.nutrient.io/blog/top-js-pdf-libraries/)
- [Best Node.js PDF Libraries: HTML to PDF Compared (PDFBolt)](https://pdfbolt.com/blog/top-nodejs-pdf-generation-libraries)
- [pdfkit - npm](https://www.npmjs.com/package/pdfkit)
