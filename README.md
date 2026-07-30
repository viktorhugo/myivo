# MyIvo

Sistema personal de captura y registro estructurado de facturas físicas y electrónicas (declaración de renta, Colombia). Fotografías o subes una factura (o el PDF de una factura electrónica), el sistema la guarda de inmediato, extrae los datos con un LLM de visión, la clasifica tributariamente y detecta duplicados. Ver `specs/001-captura-facturas/spec.md` para el detalle funcional completo, `specs/002-rediseno-visual-web/spec.md` para el rediseño visual y las capacidades que agrega (eliminar factura, detección de varias facturas en una foto, estado vacío), `specs/003-validacion-dian/spec.md` para la validación asistida de CUFEs contra la DIAN, `specs/004-reporte-anual-renta/spec.md` para el reporte anual de compras elegibles y su exportación, y `specs/005-captura-pdf-facturas/spec.md` para la captura de facturas electrónicas en PDF.

## Stack

- **Backend**: NestJS + Prisma sobre PostgreSQL (`apps/api`) — `exceljs` para parsear el Excel de conciliación con la DIAN y para generar el `.xlsx` del reporte anual; `pdfmake` para generar el `.pdf` del reporte anual (fuente estándar `Helvetica`, sin embeber archivos `.ttf`); `pdf-to-png-converter` (con `@napi-rs/canvas`, binarios prebuilt) para renderizar la primera página de una factura electrónica en PDF antes de capturarla/extraerla
- **Frontend**: Vite + React (`apps/web`) — dos temas visuales conmutables (Industry/Nocturne, ver abajo), `lucide-react` + `@phosphor-icons/react` para iconografía, fuentes auto-hospedadas vía `@fontsource/barlow`, `@fontsource/barlow-condensed` y `@fontsource/inter` (nunca CDN externo — constitution Principio VII)
- **Dominio**: TypeScript puro sin dependencias de framework (`packages/domain`) — reglas tributarias, cuadre monetario, máquina de estados
- **Monorepo**: pnpm + Turborepo
- **Extracción**: adaptador `InvoiceExtractor` sobre Claude, OpenAI, Gemini, o cualquier proveedor compatible con la API de OpenAI (Z.ai, Qwen, Kimi) — ver `specs/001-captura-facturas/research.md` § 10

## Temas visuales

La app tiene dos temas — **Industry** (claro, estética "blueprint": esquinas cuadradas, tarjetas sin relleno, marcas de registro en las esquinas) y **Nocturne** (oscuro, tarjetas con relleno, radios de 8px). Implementados en CSS puro, sin librería de UI:

- `apps/web/src/theme/tokens.css` define ambos temas completos como variables CSS bajo `[data-theme="industry"]` / `[data-theme="nocturne"]`.
- La preferencia (`industry` / `nocturne` / `system`) vive en `localStorage` del navegador — sin dato ni endpoint de servidor asociado (`useTheme.ts`).
- Un script inline en `index.html` aplica el atributo `data-theme` en `<html>` antes del primer render, para evitar el flash de tema incorrecto.
- Ver `specs/002-rediseno-visual-web/research.md` § 1-2 para el detalle de las decisiones de diseño.

## Validación DIAN

El sistema nunca consulta el portal de la DIAN de forma automática (constitution Principio VI: prohibido evadir captcha o automatizar contra un portal de terceros). Dos formas de confirmar un CUFE contra la fuente oficial, ambas asistidas:

- **Individual**: desde el Detalle de una factura con CUFE, un enlace la lleva directo al catálogo de la DIAN (`https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey={CUFE}`) con el CUFE precargado; el resultado que el usuario reporta ahí se registra manualmente en la app.
- **En lote**: el usuario aporta el Excel de documentos recibidos que él mismo descargó del portal "Facturando Electrónicamente" de la DIAN, y el sistema marca como conciliadas las facturas ya capturadas cuyo CUFE aparezca ahí.

Ver `specs/003-validacion-dian/research.md` para el detalle de estas decisiones, incluyendo una limitación conocida: el esquema exacto de columnas del Excel de conciliación no se validó contra un archivo real de la DIAN.

## Reporte anual

Responde "¿cuánto llevo este año en compras elegibles para la deducción del 1%?" sin cálculo manual: total en COP, conteo, y desglose mes a mes (siempre los 12 meses, incluidos los de $0) del año elegido — año en curso por defecto, cualquier año anterior con datos disponible en el selector.

- El resumen (total/conteo/desglose) es siempre **COP-only** — una factura elegible en otra moneda queda fuera del total, igual que en el Listado (FR-027 de la feature 001), consistente con constitution Principio II.
- Desde el reporte se puede abrir el Listado ya filtrado a las mismas facturas que componen el total (mismo año, elegibles, COP), sin reconstruir el filtro a mano.
- El estado de validación DIAN de cada factura (feature 003) es visible como contexto — nunca decide si una factura entra o no al reporte.
- **Exportación** (Excel o PDF, el usuario elige el formato en cada descarga): incluye el resumen agregado más una fila por cada factura elegible del año — a diferencia del resumen, las filas exportadas incluyen **cualquier moneda** (con su columna de moneda visible), para que el archivo sirva como soporte completo ante un contador.
- Toda presentación del reporte (pantalla o exportado) incluye siempre la nota de constitution Principio IV: es información organizada por el sistema, no un concepto tributario.

Ver `specs/004-reporte-anual-renta/research.md` para el detalle de estas decisiones (elección de `pdfmake`, por qué el desglose mensual se agrupa en memoria en vez de en SQL, y por qué el reporte y la exportación difieren en su tratamiento de moneda).

## Captura de facturas electrónicas en PDF

El PDF de una factura electrónica recibida por correo se sube por el mismo flujo de captura ya existente para fotos (mismo botón "Subir de galería") — no hay una pantalla separada ni un pipeline de extracción distinto.

- La primera página del PDF se renderiza a imagen en memoria (`pdf-to-png-converter`) antes de entrar al mismo camino que ya existía para una foto: extracción por LLM de visión, decodificación de CUFE por QR (siempre preferida sobre cualquier respaldo, constitution Principio III), clasificación tributaria y elegibilidad — ninguno de los cuatro adaptadores de `InvoiceExtractor` ni el decodificador de CUFE cambian.
- El PDF original se guarda tal cual, sin modificar (constitution Principio I) — el renderizado es un archivo derivado nuevo, vinculado al original, nunca lo reemplaza.
- Una factura ya extraída (`extraída` o `necesita_revisión`, no solo `fallida`) se puede **reprocesar** desde su Detalle sin borrarla ni resubir el archivo — útil, por ejemplo, después de corregir `MIS_IDENTIFICACIONES` en `apps/api/.env`: la elegibilidad se calcula una sola vez durante la extracción y no se recalcula sola porque cambie la configuración externa.

Ver `specs/005-captura-pdf-facturas/research.md` para el detalle de estas decisiones (por qué `pdf-to-png-converter` sobre otras librerías, y por qué se prefirió no renombrar `Factura.rutaImagenOriginal`).

## Requisitos

- Node.js 22 LTS
- pnpm 10.x (`packageManager` en `package.json`)
- Docker (para PostgreSQL en desarrollo)

## Desarrollo local

```bash
pnpm install

# Variables de entorno
cp .env.example .env                       # credenciales de postgres/caddy
cp apps/api/.env.example apps/api/.env     # ver comentarios de cada variable en el archivo

# Base de datos
docker compose up -d postgres
pnpm --filter @myivo/api prisma:migrate

# Genera el hash de tu contraseña (FR-030, un solo usuario) y pégalo en apps/api/.env
node -e "require('argon2').hash('tu-contraseña').then(console.log)"

pnpm build
pnpm --filter @myivo/api dev    # API en :3000
pnpm --filter @myivo/web dev    # SPA en :5173
```

Variables imprescindibles antes del primer uso real (`apps/api/.env`):

- `AUTH_PASSWORD_HASH` — hash Argon2 de tu contraseña, no un placeholder
- `MIS_IDENTIFICACIONES` — tu(s) cédula/NIT; sin esto ningún documento puede calificar como elegible (FR-015)
- `EXTRACTION_PROVIDER` + la API key del proveedor elegido

## Tests

```bash
pnpm test        # Jest — reglas de dominio (obligatorio por constitution Principio VIII)
pnpm typecheck
pnpm lint
```

## Despliegue

Diseño previsto (`Caddyfile`, `docker-compose.yml`): Caddy como reverse proxy con TLS automático, sirviendo la SPA compilada y haciendo proxy de `/api/*` hacia el contenedor de la API; PostgreSQL en un volumen Docker; imágenes originales en un volumen Docker aparte (`invoice_images`), nunca sobrescritas (constitution Principio I).

**Estado actual**: `docker-compose.yml` solo define el servicio `postgres` (usado también en desarrollo). Los servicios `api` y `web`/Caddy en compose son trabajo pendiente — hoy la API se ejecuta directamente (`node dist/main.js`) fuera de Docker. Antes de desplegar en el VPS real falta: agregar esos dos servicios al compose, montar `invoice_images` en el contenedor de `api`, y fijar `APP_DOMAIN`/`CADDY_ACME_EMAIL` en el `.env` de la raíz.

**Costo operativo estimado** (constitution Principio VII, objetivo <15 USD/mes):

- VPS pequeño (1 vCPU / 1-2 GB RAM, tipo Hetzner CX22 o DigitalOcean droplet básico): ~4-6 USD/mes
- Extracción con Claude Sonnet 5 a este volumen (backlog inicial + goteo semanal de facturas): <2 USD/mes (`research.md` § 3)
- Sin telemetría de terceros ni servicios adicionales de pago

Total esperado muy por debajo del límite constitucional.
