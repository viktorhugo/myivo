# Research: Rediseño visual — temas Industry/Nocturne

## 1. Tipografías de ambos temas (Barlow, Barlow Condensed, Inter)

**Decision**: Auto-hospedar los archivos `.woff2` de las 3 familias tipográficas como archivos estáticos dentro de `apps/web/src/theme/fonts/`, referenciados por `@font-face` en `tokens.css` — nunca vía `<link>` a `fonts.googleapis.com` ni ningún otro CDN de fuentes.

**Rationale**: Cargar una fuente desde un CDN externo en cada visita filtra la IP y el user-agent del usuario a ese tercero en cada carga de página — exactamente lo que constitution Principio VII prohíbe ("Telemetría a terceros: cero"). Las 3 familias (Barlow, Barlow Condensed, Inter) son de Google Fonts bajo licencia Open Font License, libremente redistribuibles como archivos estáticos — no hay razón para depender del CDN.

**Alternatives considered**: Cargar desde `fonts.googleapis.com` (descartado, viola Principio VII); usar fuentes del sistema como fallback permanente (descartado, el diseño de referencia exige tipografías específicas para la identidad visual de cada tema, no negociable según el handoff de diseño).

## 2. Mecanismo de dos temas sin librería de UI nueva

**Decision**: Variables CSS (`:root[data-theme="industry"]` / `:root[data-theme="nocturne"]`) definidas en un único `tokens.css`, con un atributo `data-theme` en el elemento `<html>` que un hook (`useTheme.ts`) sincroniza con la preferencia guardada. Los componentes React existentes migran sus estilos inline actuales a clases/CSS que consumen `var(--color-...)` en vez de valores hardcodeados.

**Rationale**: Decisión explícita del usuario — el proyecto no tiene hoy ninguna dependencia de UI/CSS-in-JS (`apps/web/package.json` solo lista `react`/`react-dom`), y los dos temas son enteramente expresables como un conjunto de valores de color/tipografía/espaciado por CSS puro. Introducir Tailwind, styled-components o similar para esto sería una dependencia nueva sin beneficio proporcional al alcance (2 temas, 5 pantallas).

**Alternatives considered**: CSS-in-JS (styled-components/Emotion) — descartado, dependencia nueva innecesaria; Tailwind con `dark:` variants — descartado, el proyecto no lo usa hoy y el modelo de "2 temas nombrados" (no solo claro/oscuro binario) no calza naturalmente con las variantes de Tailwind sin configuración adicional.

## 3. Persistencia de la preferencia de tema

**Decision**: `localStorage` del navegador (clave única, valor `"industry" | "nocturne" | "system"`), leído al montar la app y aplicado antes del primer render visible cuando sea posible (evitar parpadeo).

**Rationale**: Es una preferencia puramente de presentación, sin ningún vínculo con los datos de negocio (facturas, elegibilidad) — no hay razón para enviarla al backend ni persistirla en la base de datos de un sistema de un solo usuario. Coherente con FR-003 (persiste entre sesiones del mismo usuario, mismo navegador).

**Alternatives considered**: Persistir en el backend (columna de preferencia de usuario) — descartado, sobre-ingeniería para una app de un solo usuario donde la preferencia es por dispositivo/navegador, no por identidad.

## 4. Detección de "varias facturas en una foto" (FR-010/FR-011)

**Decision**: Agregar un campo booleano (`múltiplesDocumentos: boolean`) al mismo schema Zod `extractedInvoiceDataSchema` que ya valida toda salida del `InvoiceExtractor` (constitution Principio III), y una instrucción explícita en el prompt de extracción compartido (`extraction-prompt.ts`) pidiendo al modelo señalar este caso. El orquestador (`extraction.processor.ts`) revisa este campo antes de continuar: si es `true`, transiciona la `Factura` (el mismo registro ya creado al subir la foto, per Clarifications) al nuevo estado `varias_facturas` y no persiste ningún otro campo extraído.

**Rationale**: Reutiliza exactamente el mecanismo ya existente de validación estricta contra schema (Principio III) — no se introduce un segundo modelo, llamada, ni proveedor. Es coherente con cómo ya se maneja cualquier otra señal de baja confiabilidad de la extracción (todo pasa por el mismo `InvoiceExtractor`/schema).

**Alternatives considered**: Un modelo de visión separado dedicado solo a "contar documentos en la imagen" antes de la extracción principal — descartado, duplica el costo de una llamada a un LLM con visión por cada foto para resolver algo que el mismo modelo ya puede señalar como parte de su salida existente; el propio `spec.md` acepta explícitamente que sea best-effort, no se necesita un mecanismo separado más costoso para mejorar una garantía que de todos modos no se promete al 100%.

## 5. Endpoint de "Eliminar factura" (soft-delete, FR-008/FR-009)

**Decision**: `POST /invoices/:id/delete` (no el verbo HTTP `DELETE`), que marca `eliminadaEn = now()` sobre el registro existente. `GET /invoices/:id`, `GET /invoices` (listado) y sus agregados excluyen explícitamente cualquier registro con `eliminadaEn` no nulo — comportamiento equivalente a "no encontrado" ante cualquier consulta directa (Clarifications, sesión 2026-07-27).

**Rationale**: El propio `contracts/api.md` de la feature 001 ya documentó esta decisión de antemano, aunque nunca se construyó: *"Ningún endpoint permite un DELETE físico de una factura o de su imagen — eliminar es siempre soft-delete (FR-029), expuesto como una transición de estado, no como una operación HTTP DELETE sobre el recurso."* Esta feature simplemente materializa esa decisión ya tomada.

**Alternatives considered**: Verbo HTTP `DELETE /invoices/:id` — descartado explícitamente por la nota de contrato ya existente en la feature 001, para evitar que la semántica REST estándar ("recurso destruido") sugiera una eliminación física que nunca ocurre.

## 6. Iconografía (Lucide para Industry, Phosphor para Nocturne)

**Decision**: Paquetes npm de iconos SVG (`lucide-react`, `phosphor-react` o equivalentes mantenidos), importados como componentes React — no una fuente de íconos vía CDN.

**Rationale**: A diferencia de las tipografías, los paquetes de iconos SVG se empaquetan en el build de Vite (sin llamada de red en tiempo de ejecución) — no hay conflicto con constitution Principio VII. Son librerías pequeñas y ampliamente usadas, alineadas 1:1 con lo que especifica el diseño de referencia (trazo delgado estilo Lucide en Industry, estilo Phosphor en Nocturne).

**Alternatives considered**: Recrear cada ícono a mano como SVG inline — descartado, sobre-ingeniería frente a usar las librerías que el propio diseño de referencia ya nombra explícitamente.
