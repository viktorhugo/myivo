import { betterAuth } from 'better-auth';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import { Resend } from 'resend';
import type { PrismaClient } from '@prisma/client';
import type { Env } from '../../config/env.schema';

/** Token de inyección — `betterAuth(...)` no es una clase, no se puede inyectar por tipo. */
export const AUTH = Symbol('AUTH');

/** Solo lo que crearAuth necesita — un `Env` completo lo satisface, pero también permite reusarlo fuera de Nest (scripts/migrar-datos-existentes.ts) sin construir un ConfigService. */
export type EnvParaAuth = Pick<
  Env,
  'RESEND_API_KEY' | 'BETTER_AUTH_SECRET' | 'BETTER_AUTH_URL' | 'EMAIL_FROM' | 'WEB_ORIGIN'
>;

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
      },
    },
  });
}

export type Auth = ReturnType<typeof crearAuth>;
