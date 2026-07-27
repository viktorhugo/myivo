# MyIvo

Sistema personal de captura y registro estructurado de facturas físicas (declaración de renta, Colombia). Fotografías o subes una factura, el sistema la guarda de inmediato, extrae los datos con un LLM de visión, la clasifica tributariamente y detecta duplicados. Ver `specs/001-captura-facturas/spec.md` para el detalle funcional completo.

## Stack

- **Backend**: NestJS + Prisma sobre PostgreSQL (`apps/api`)
- **Frontend**: Vite + React (`apps/web`)
- **Dominio**: TypeScript puro sin dependencias de framework (`packages/domain`) — reglas tributarias, cuadre monetario, máquina de estados
- **Monorepo**: pnpm + Turborepo
- **Extracción**: adaptador `InvoiceExtractor` sobre Claude, OpenAI, Gemini, o cualquier proveedor compatible con la API de OpenAI (Z.ai, Qwen, Kimi) — ver `specs/001-captura-facturas/research.md` § 10

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
