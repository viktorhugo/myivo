import { betterAuth } from 'better-auth';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import { passkey } from '@better-auth/passkey';
import { twoFactor } from 'better-auth/plugins/two-factor';
import { Resend } from 'resend';
import type { PrismaClient } from '@prisma/client';
import type { Env } from '../../config/env.schema';

/** Token de inyección — `betterAuth(...)` no es una clase, no se puede inyectar por tipo. */
export const AUTH = Symbol('AUTH');

/** Solo lo que crearAuth necesita — un `Env` completo lo satisface, pero también permite reusarlo fuera de Nest (scripts/migrar-datos-existentes.ts) sin construir un ConfigService. */
export type EnvParaAuth = Pick<Env, 'RESEND_API_KEY' | 'BETTER_AUTH_SECRET' | 'BETTER_AUTH_URL' | 'EMAIL_FROM' | 'WEB_ORIGIN'>;

// specs/006-multi-usuario/research.md § 1 (Better Auth) y § 2 (Resend). El
// registro con correo/contraseña exige verificar el correo antes de poder
// iniciar sesión (FR-002, spec.md Clarifications) — sin eso, cualquiera
// podría registrarse con un correo ajeno y usar la cuenta igual.
export function crearAuth(prisma: PrismaClient, env: EnvParaAuth) {
  const resend = new Resend(env.RESEND_API_KEY);

  return betterAuth({
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    // Default "/api/auth" — pero main.ts monta el handler en "/auth/*splat"
    // (sin /api: el proxy de Vite ya lo quita antes de reenviar al backend,
    // igual que cualquier otro @Controller()). Sin esto, Better Auth
    // rechazaba con 404 cada request aunque Express sí la enrutara bien: la
    // librería compara internamente contra su propio basePath esperado,
    // independiente de dónde Express la monte.
    basePath: '/auth',
    // El navegador manda el Origin real de la página (localhost:5173 en
    // dev) sin importar que Vite/Nginx reenvíe la petición — sin esto
    // Better Auth la rechaza como posible CSRF ("Invalid origin").
    trustedOrigins: [env.WEB_ORIGIN],

    // El rate limiter de Better Auth ya viene activo en producción por
    // defecto (`enabled: options.rateLimit?.enabled ?? isProduction`,
    // create-context.mjs) y ya trae una regla especial para /sign-in* (10s/3
    // intentos, api/rate-limiter/index.mjs) — FR-008 no necesita una
    // librería nueva. Se ajusta /sign-in/email al valor sugerido en las
    // Assumptions del spec (5 intentos / 15 min): más tolerante a un usuario
    // real que se equivoca de contraseña en el celular, sin dejar de
    // bloquear fuerza bruta sostenida (specs/007-despliegue-produccion/
    // research.md § 3).
    rateLimit: {
      customRules: {
        '/sign-in/email': { window: 900, max: 5 },
      },
    },

    advanced: {
      ipAddress: {
        // Misma subred fija en docker-compose.yml (myivo_internal) — sin
        // esto, la resolución de IP real del cliente detrás de Caddy solo
        // funciona si X-Forwarded-For trae un único valor (comportamiento
        // por defecto de Caddy hoy, pero no garantizado si en el futuro se
        // agrega otro proxy delante, p. ej. un CDN).
        trustedProxies: ['172.28.0.0/16'],
      },
    },

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
    },

    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await resend.emails.send({
          from: env.EMAIL_FROM,
          to: user.email,
          subject: 'Verifica tu correo — MyIvo',
          html: `<p>Confirma tu cuenta de MyIvo para empezar a capturar tus facturas.</p><p><a href="${url}">Verificar correo</a></p><p>Si no creaste esta cuenta, ignora este correo.</p>`,
        });
      },
    },

    user: {
      additionalFields: {
        // Reemplaza MIS_IDENTIFICACIONES (FR-007) — propia de cada cuenta,
        // nunca se fija en el registro (US2, PUT /cuenta/identificaciones).
        identificacionesTributarias: {
          type: 'string[]',
          input: false,
          defaultValue: [],
        },
        // specs/008-borrado-cuenta: nunca se fija por input de usuario — solo
        // CuentaEliminacionService la escribe. SessionUsuarioGuard la lee
        // directo de sesion.user (sin query propia) para decidir si bloquea
        // la cuenta (constitution Principio I v2.1.0).
        eliminacionProgramadaPara: {
          type: 'date',
          required: false,
          input: false,
        },
      },
    },

    plugins: [
      passkey({
        rpID: new URL(env.WEB_ORIGIN).hostname,
        rpName: 'MyIvo',
        origin: env.WEB_ORIGIN,
        // default (requireSession: true): un passkey se agrega desde "Mi
        // cuenta" con sesión activa, nunca como método de registro nuevo.
      }),
      twoFactor({
        issuer: 'MyIvo',
      }),
    ],
  });
}

export type Auth = ReturnType<typeof crearAuth>;
