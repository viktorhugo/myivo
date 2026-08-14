import { z } from 'zod';

/**
 * Proveedor de extracción activo (FR-031, research.md § 10). Agregar un
 * proveedor nuevo implica: un valor aquí, su API key abajo, y una entrada en
 * `API_KEY_POR_PROVEEDOR` — el resto de la validación es genérico.
 */
export const extractionProviderSchema = z.enum([
  'claude',
  'openai',
  'gemini',
  'zai',
  'qwen',
  'kimi',
  'deepseek',
  'openrouter',
]);

export type ExtractionProvider = z.infer<typeof extractionProviderSchema>;

const API_KEY_POR_PROVEEDOR = {
  claude: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  zai: 'ZAI_API_KEY',
  qwen: 'QWEN_API_KEY',
  kimi: 'KIMI_API_KEY',
  // La API pública de DeepSeek todavía es solo texto (jul-2026) — su visión
  // está en pruebas gray-scale, sin API general. Preset ya cableado en
  // openai-compatible-invoice-extractor.adapter.ts (misma forma que
  // zai/qwen/kimi) pero extraction.module.ts la rechaza explícitamente
  // hasta que soporte imágenes — ver el comentario ahí para reactivarla.
  deepseek: 'DEEPSEEK_API_KEY',
  // Agregador (research por pedido del usuario, jul-2026): una sola cuenta
  // da acceso a muchos modelos abiertos con visión (Qwen3-VL, GLM, Llama,
  // etc.) vía API compatible con OpenAI — EXTRACTION_MODEL elige cuál, p.
  // ej. "qwen/qwen3.7-flash" (confirmado en openrouter.ai/api/v1/models).
  openrouter: 'OPENROUTER_API_KEY',
} as const satisfies Record<ExtractionProvider, string>;

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  IMAGE_STORAGE_PATH: z.string().min(1).default('./data/invoices'),

  // specs/007-despliegue-produccion — FR-012/FR-013 (US3): un lote grande
  // (p. ej. 80 archivos) no debe poder tumbar el servidor por tamaño o
  // cantidad sin límite. Defaults generosos para fotos de celular (spec.md
  // § Assumptions), configurables sin cambiar código.
  UPLOAD_MAX_FILE_SIZE_MB: z.coerce.number().int().positive().default(20),
  UPLOAD_MAX_FILES_PER_BATCH: z.coerce.number().int().positive().default(100),

  // specs/006-multi-usuario/research.md § 1 — Better Auth. Reemplaza
  // SESSION_SECRET/AUTH_USERNAME/AUTH_PASSWORD_HASH: ya no hay una sola
  // cuenta fija, cualquiera se registra (FR-001).
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET debe tener al menos 32 caracteres'),
  BETTER_AUTH_URL: z.string().url(),
  // Origen exacto (protocolo+host+puerto) desde donde el navegador carga el
  // frontend — Better Auth rechaza por CSRF cualquier request cuyo header
  // Origin no esté en esta lista, sin importar que el proxy de Vite/Nginx
  // reenvíe la petición: el navegador siempre manda el Origin real de la
  // página, no el del proxy.
  WEB_ORIGIN: z.string().url(),

  // research.md § 2 — Resend, para el correo de verificación (FR-002).
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1, 'Remitente del correo de verificación, ej. "MyIvo <no-reply@tu-dominio.com>"'),

  // Login social (opcional, por proveedor — auth.ts solo activa el que tenga
  // ambas variables presentes). URL de redirección a registrar en cada
  // consola: {BETTER_AUTH_URL}/callback/{proveedor} — con basePath: '/auth'
  // (auth.ts), NO es /api/auth/callback/... como muestran los ejemplos
  // genéricos de la documentación.
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  MICROSOFT_CLIENT_ID: z.string().min(1).optional(),
  MICROSOFT_CLIENT_SECRET: z.string().min(1).optional(),
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),

  EXTRACTION_PROVIDER: extractionProviderSchema.default('claude'),
  EXTRACTION_MODEL: z.string().min(1).default('claude-sonnet-5'),
  // FR-011 (US3): cuántas extracciones corren a la vez como máximo — sin
  // esto, un lote de N archivos dispara N llamadas simultáneas al proveedor
  // de extracción (research.md § 4). Conservador por defecto: personal, un
  // solo proceso Node, no hace falta agresivo.
  EXTRACTION_MAX_CONCURRENCY: z.coerce.number().int().positive().default(3),

  // Cada API key es opcional a nivel de forma: solo se exige la del
  // proveedor activo (ver superRefine abajo) — así no hace falta configurar
  // las 6 para usar una sola (constitution Principio VII).
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  ZAI_API_KEY: z.string().min(1).optional(),
  QWEN_API_KEY: z.string().min(1).optional(),
  KIMI_API_KEY: z.string().min(1).optional(),
  DEEPSEEK_API_KEY: z.string().min(1).optional(),
  OPENROUTER_API_KEY: z.string().min(1).optional(),
});

export const envSchema = baseEnvSchema.superRefine((config, ctx) => {
  const claveRequerida = API_KEY_POR_PROVEEDOR[config.EXTRACTION_PROVIDER];
  if (!config[claveRequerida]) {
    ctx.addIssue({
      code: 'custom',
      path: [claveRequerida],
      message: `Requerida porque EXTRACTION_PROVIDER="${config.EXTRACTION_PROVIDER}"`,
    });
  }
});

export type Env = z.infer<typeof baseEnvSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuración de entorno inválida:\n${issues}`);
  }
  return result.data as Env;
}

/** La API key correspondiente al proveedor activo — usarla evita repetir el `switch` en cada punto de llamada. */
export function apiKeyDelProveedorActivo(env: Env): string {
  const clave = API_KEY_POR_PROVEEDOR[env.EXTRACTION_PROVIDER];
  const valor = env[clave];
  if (!valor) {
    // No debería pasar: envSchema.superRefine ya lo exige al arranque.
    throw new Error(`${clave} no está configurada para EXTRACTION_PROVIDER="${env.EXTRACTION_PROVIDER}"`);
  }
  return valor;
}
