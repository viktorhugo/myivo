import { z } from 'zod';

/**
 * Proveedor de extracción activo (FR-031, research.md § 10). Agregar un
 * proveedor nuevo implica: un valor aquí, su API key abajo, y una entrada en
 * `API_KEY_POR_PROVEEDOR` — el resto de la validación es genérico.
 */
export const extractionProviderSchema = z.enum(['claude', 'openai', 'gemini', 'zai', 'qwen', 'kimi']);

export type ExtractionProvider = z.infer<typeof extractionProviderSchema>;

const API_KEY_POR_PROVEEDOR = {
  claude: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  zai: 'ZAI_API_KEY',
  qwen: 'QWEN_API_KEY',
  kimi: 'KIMI_API_KEY',
} as const satisfies Record<ExtractionProvider, string>;

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET debe tener al menos 32 caracteres'),
  AUTH_USERNAME: z.string().min(1),
  AUTH_PASSWORD_HASH: z
    .string()
    .min(1, 'Debe ser un hash Argon2, nunca la contraseña en texto plano'),
  IMAGE_STORAGE_PATH: z.string().min(1).default('./data/invoices'),

  // Número(s) de identificación del usuario (cédula y/o NIT), separados por
  // coma — contra esto se compara `adquirienteIdentificacion` para calcular
  // elegibilidad tributaria (FR-015, spec.md § Assumptions). Requerido y sin
  // default: sin esto, todo documento sería "no elegible" en silencio.
  MIS_IDENTIFICACIONES: z
    .string()
    .min(1, 'Configura al menos tu cédula o NIT — sin esto ningún documento puede ser elegible')
    .transform((valor) =>
      valor
        .split(',')
        .map((identificacion) => identificacion.trim())
        .filter((identificacion) => identificacion.length > 0),
    ),

  EXTRACTION_PROVIDER: extractionProviderSchema.default('claude'),
  EXTRACTION_MODEL: z.string().min(1).default('claude-sonnet-5'),

  // Cada API key es opcional a nivel de forma: solo se exige la del
  // proveedor activo (ver superRefine abajo) — así no hace falta configurar
  // las 6 para usar una sola (constitution Principio VII).
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  ZAI_API_KEY: z.string().min(1).optional(),
  QWEN_API_KEY: z.string().min(1).optional(),
  KIMI_API_KEY: z.string().min(1).optional(),
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
