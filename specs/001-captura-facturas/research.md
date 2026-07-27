# Research: Captura y Registro Estructurado de Facturas

**Fase 0** — Decisiones técnicas para las 5 historias de usuario, coherentes con la constitution y con el orden de entrega incremental (H1 → H2 → H3 → H4 → H5).

## 1. Framework de frontend

**Decision**: Vite + React (SPA), sin SSR.

**Rationale**: La app es de un solo usuario, sin necesidad de SEO ni renderizado en servidor. Un SPA servido como archivos estáticos detrás de Caddy no requiere un proceso Node adicional en producción, lo que simplifica el `docker compose` y reduce superficie de mantenimiento — alineado con el objetivo de costo/operación simple del Principio VII. La captura de foto se resuelve con `<input type="file" accept="image/*" capture="environment">` (fallback universal) y, si se quiere una experiencia de cámara en vivo, `getUserMedia` progresivamente.

**Alternatives considered**: Next.js — descartado porque su valor (SSR, rutas API integradas) no aporta nada aquí: ya hay un backend NestJS separado, y correr un proceso Next adicional solo añade un contenedor más al VPS pequeño sin beneficio.

## 2. ORM / persistencia

**Decision**: Prisma sobre PostgreSQL.

**Rationale**: La constitution nombra "Prisma/TypeORM" como ejemplos de lo que el dominio no debe importar directamente (Principio V), dejando la elección al adaptador. Prisma da tipado generado a partir del schema, migraciones versionadas simples, y soporte directo para `Decimal` (necesario para el Principio II — nunca `Float` para dinero) y para la extensión `pg_trgm` de Postgres (necesaria para el matching difuso de duplicados, ver §6).

**Alternatives considered**: TypeORM — más flexible con decoradores pero con peor ergonomía de migraciones y tipado; sin ventaja concreta para este caso.

## 3. Modelo de extracción (LLM con visión)

**Decision**: Claude Sonnet 5 (`claude-sonnet-5`) vía el SDK oficial `@anthropic-ai/sdk`, con **structured output** (`output_config.format` / `client.messages.parse()` con schema Zod), no `tool_use`.

**Rationale**: Es una tarea de extracción acotada (leer ~10 campos de una foto), no de razonamiento multi-paso — el tier recomendado para "extraction, classification, Q&A" es un LLM call único, y Sonnet 5 es el punto de equilibrio estándar costo/calidad para ese tier. A este volumen (backlog de 50-200 fotos + goteo semanal) el costo es irrelevante para la decisión: incluso Opus 5 costaría ~5-6 USD/mes; la variable que importa es la precisión de extracción, no el precio. `output_config.format` es el mecanismo correcto porque no hay una herramienta que el modelo decida invocar — siempre se quiere el mismo objeto de vuelta con la misma forma. La salida de la API ya viene validada contra el schema JSON, pero igual pasa por Zod en el dominio antes de persistir (Principio III: dos capas de validación con propósitos distintos — forma vs. reglas de negocio).

**Alternatives considered**: Opus 5 — descartado como default por ser innecesariamente costoso para esta tarea (la diferencia de calidad esperada en extracción de recibos es marginal frente al salvavidas de confianza/revisión manual que ya exige el Principio III); queda como opción de escalamiento si una validación con fotos reales muestra que Sonnet 5 falla sistemáticamente en algo. Haiku 4.5 — descartado como extractor principal: el ahorro frente a Sonnet 5 es de ~2 USD/mes, irrelevante frente al riesgo de errores en montos que alimentan cálculos tributarios.

**Costo estimado**: ~0.015 USD/imagen con Sonnet 5 (imagen ~2500 tokens + salida ~500 tokens). Backlog de 200 fotos vía **Message Batches API** (50% descuento, sin problema de latencia porque el procesamiento es asíncrono) ≈ 1.50 USD una sola vez; goteo semanal (~20-30 fotos/mes) sin batch ≈ 0.30-0.45 USD/mes. Total muy por debajo del objetivo de <15 USD/mes del Principio VII.

**Prompt caching**: las instrucciones de extracción y el schema son fijos entre llamadas (solo cambia la imagen) — marcarlos con `cache_control` recorta ~90% del costo de esa porción desde la segunda llamada en adelante.

## 4. Decodificación de CUFE/CUDE (QR)

**Decision**: Librería de decodificación de QR determinística en el adaptador (p. ej. `jsqr` sobre el buffer de la imagen), ejecutada **antes y de forma independiente** de la llamada al LLM.

**Rationale**: Constitution Principio III: "El CUFE se obtiene por decodificación determinística del código QR, nunca por OCR." Esto no es una tarea del modelo de lenguaje — es procesamiento de imagen determinístico. El fallback a lectura del CUFE impreso (FR-008) sí puede apoyarse en el mismo paso de extracción por LLM, pero marcado con confianza reducida.

## 5. Autenticación de un solo usuario (FR-030)

**Decision**: Sesión de servidor con cookie firmada (`httpOnly`, `secure`, `sameSite=strict`) + hash de contraseña con Argon2. HTTPS terminado por Caddy.

**Rationale**: Un solo usuario no necesita OAuth ni un proveedor externo (que además violaría el "cero telemetría a terceros" del Principio VII si fuera de terceros). Sesión de servidor es más simple de razonar y revocar que JWT sin estado, y no hay ningún caso de uso que necesite statelessness (no hay múltiples servicios consumiendo el token). Caddy se elige sobre Nginx+certbot por renovación automática de certificados con configuración mínima, coherente con la simplicidad operativa exigida.

**Alternatives considered**: Passkeys — mencionado como opción en la clarificación, pero se deja como mejora futura opcional; usuario/contraseña + Argon2 ya satisface FR-030 con la menor complejidad de implementación.

## 6. Coincidencia difusa para duplicados probables (FR-020)

**Decision**: Extensión `pg_trgm` de PostgreSQL para similitud de texto sobre el nombre de comercio normalizado (minúsculas, sin tildes/puntuación), combinada con igualdad exacta de fecha calendario y total.

**Rationale**: Mantiene la lógica de coincidencia dentro de la base de datos sin añadir un servicio o librería externa; `pg_trgm` es estándar, ligero, y suficiente para tolerar el ruido de OCR esperado (variaciones menores de un mismo nombre de comercio) sin sobre-ingeniería (no se necesita un servicio de fuzzy-matching dedicado para este volumen).

**Hallazgo con datos reales (post-MVP)**: validando con fotos reales de celular, la misma factura (D1, subida dos veces) produjo dos CUFEs distintos en un carácter. El CUFE de esa factura viene de OCR (`cufeOrigen: 'ocr_respaldo'`) porque el QR de la foto no era legible (ángulo/brillo/resolución) — y el modelo de visión no transcribe con exactitud garantizada un texto impreso largo. Como el diseño original de FR-019/FR-020 excluía del mecanismo difuso a cualquier documento con CUFE (para evitar falsos positivos entre facturas electrónicas distintas), este caso no era detectado por ninguna de las dos reglas: ni exacto (los CUFEs difieren) ni difuso (se salta porque hay CUFE).

**Ajuste**: un CUFE de QR sigue excluyendo el mecanismo difuso sin cambios (sigue siendo confiable). Un CUFE de OCR (`cufeOrigen: 'ocr_respaldo'`) ya no lo hace — si no hay coincidencia exacta, el documento cae al mecanismo difuso igual que uno sin CUFE. FR-020 se actualizó para reflejar esta condición. Implementado en `duplicate-matching.service.ts`, verificado de nuevo con la misma foto real.

## 7. Representación de imágenes (original + derivados)

**Decision**: Filesystem local del VPS, montado como volumen Docker; derivados (comprimido, recortado) generados con `sharp` y guardados como archivos nuevos vinculados al original por ID.

**Rationale**: Principio VII exige infraestructura controlada por el usuario y costo mínimo — un bucket S3-compatible añadiría complejidad y potencialmente costo sin necesidad a este volumen. El volumen Docker es suficiente y cumple el Principio I (el original nunca se sobrescribe; los derivados son archivos distintos).

## 8. Testing

**Decision**: Jest para tests unitarios de dominio (reglas tributarias, cuadre monetario, máquina de estados — obligatorios por constitution Principio VIII).

**Rationale**: Es el framework de testing estándar del ecosistema NestJS (su CLI lo configura por defecto), lo que reduce fricción de configuración frente a introducir Vitest solo para el backend. El frontend puede usar Vitest si se decide agregar tests de UI más adelante — no es obligatorio por spec (los tests son opcionales salvo para reglas de dominio).

## 9. Procesamiento por lotes del backlog (H1 / SC-001)

**Decision**: La ingesta de fotos en lote se separa de la extracción: FR-002/FR-003 (guardar de inmediato) ocurren de forma síncrona por foto; la extracción (H2) se encola de forma asíncrona y, para el backlog inicial, puede despacharse vía **Message Batches API** de Anthropic en vez de llamadas síncronas una por una.

**Rationale**: El backlog acumulado (SC-001: al menos 50 fotos en una sesión) no tiene restricción de latencia — encaja exactamente con el caso de uso de Batches (hasta 50% más barato, resultados en minutos/horas). Esto es coherente con FR-003/FR-004: la foto se guarda y el estado pasa a "procesando" independientemente del mecanismo de despacho de la extracción.

## 10. Selección de proveedor de extracción (multi-modelo, FR-031)

**Decision**: `EXTRACTION_PROVIDER` (`claude` | `openai` | `gemini` | `zai` | `qwen` | `kimi`) y `EXTRACTION_MODEL` como variables de entorno, validadas al arranque (constitution Principio VII: secretos y configuración vía env vars, fail-fast). Cada proveedor tiene su propia variable de API key (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ZAI_API_KEY`, `QWEN_API_KEY`, `KIMI_API_KEY`); el schema Zod de entorno exige solo la que corresponde al proveedor activo. Una fábrica en `ExtractionModule` decide, según `EXTRACTION_PROVIDER`, cuál implementación de `InvoiceExtractor` inyectar — el orquestador y el resto del sistema no saben qué proveedor está activo.

**Arquitectura de adaptadores** — 3 implementaciones, no 6, porque 3 de los 6 proveedores exponen una API compatible con la de OpenAI (mismo formato de petición, cambia solo `baseURL`):

- `ClaudeInvoiceExtractorAdapter` — SDK `@anthropic-ai/sdk`, `messages.create()` **sin** `output_config.format`. Se probó con `zodOutputFormat` (salida estructurada estricta) primero, pero se descartó tras verificar con una foto real (tiquete D1, 21 ítems): la decodificación restringida por JSON Schema corta la respuesta a mitad del arreglo de ítems — `stop_reason: "end_turn"` mal reportado pero el JSON queda sintácticamente incompleto, reproducible incluso duplicando `max_tokens` (8192 → 16384, mismo punto de corte). El "thinking" adaptativo del modelo (no solicitado explícitamente, pero presente en la respuesta — hasta ~7700 tokens en una sola llamada) consume presupuesto antes de escribir el JSON, y la combinación con decodificación restringida + arreglo largo parece ser lo que falla. La MISMA extracción, pidiendo el JSON por instrucción de prompt en vez de por schema estricto, salió completa y válida — ese es el enfoque adoptado (`EXTRACTION_SYSTEM_PROMPT_CON_SCHEMA`), igual que el adaptador genérico compatible con OpenAI. `parsearJsonDeRespuesta()` limpia además un bloque de código markdown (`` ```json...``` ``) que Claude envolvió alrededor del JSON a pesar de la instrucción — comportamiento común en varios proveedores, no exclusivo de este caso.
- `OpenAIInvoiceExtractorAdapter` — SDK `openai`, `chat.completions.parse()` + `zodResponseFormat` (salida estructurada estricta vía JSON Schema). **No verificado con una llamada real** (sin API key de OpenAI) — si en el futuro se prueba con una factura de muchos ítems y falla de forma similar a Claude, aplicar el mismo cambio (prompt + `parsearJsonDeRespuesta`, ya disponible en `extraction-prompt.ts`).
- `GeminiInvoiceExtractorAdapter` — SDK `@google/genai`, `generateContent()` con `responseMimeType: 'application/json'` + `responseJsonSchema` (generado desde el mismo schema Zod del dominio vía `z.toJSONSchema()`, nativo de Zod v4 — un solo schema, no uno por proveedor).
- `OpenAICompatibleInvoiceExtractorAdapter` — genérico, reutilizado para `zai`, `qwen` y `kimi`: SDK `openai` apuntado a un `baseURL` distinto por proveedor. Usa `response_format: {type: 'json_object'}` (modo JSON básico, no JSON Schema estricto) en vez de `zodResponseFormat`, porque el soporte de JSON Schema estricto no está confirmado de forma uniforme en estos tres — el schema completo se describe en el system prompt en su lugar.

**Rationale**: el puerto `InvoiceExtractor` (constitution Principio V) ya fue diseñado para esto — agregar proveedores es agregar adaptadores, no tocar dominio/orquestador/base de datos. Usar `response_format: json_object` (no estricto) para el adaptador genérico es una decisión de robustez, no de descuido: el dominio ya valida la salida de CUALQUIER adaptador con `validarExtraccion` antes de persistir (Principio III) — si un proveedor devuelve JSON mal formado o incompleto, esa segunda capa lo rechaza y el orquestador lo trata como fallo total (FR-013), exactamente igual que si Claude fallara. La solidez del sistema no depende de que cada proveedor tenga soporte perfecto de JSON Schema.

**Valores de ejemplo verificados en julio 2026** (documentar en `.env.example` con advertencia de que los proveedores cambian nombres de modelo con frecuencia):

- Z.ai: `baseURL=https://api.z.ai/api/paas/v4/`, modelo de ejemplo `glm-5v-turbo`.
- Qwen/DashScope: `baseURL` depende de la región de la cuenta (p. ej. `https://dashscope-us.aliyuncs.com/compatible-mode/v1` para EE.UU.; verificar la propia en la consola de Alibaba Cloud), modelo de ejemplo `qwen3-vl-plus`.
- Kimi/Moonshot: `baseURL=https://api.moonshot.ai/v1`, modelo de ejemplo `kimi-k3` (visión nativa).

**Alternatives considered**: seis adaptadores completamente independientes — descartado, sería código casi idéntico repetido 3 veces para los proveedores compatibles con OpenAI, sin ningún beneficio. Un único adaptador "universal" con un `switch` interno por proveedor — descartado, mezclaría las dos SDKs nativas (Claude, Gemini) con la lógica del adaptador genérico y complicaría las pruebas de cada uno por separado; el patrón de puertos/adaptadores ya favorece archivos separados y pequeños.
