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
export type EnvParaAuth = Pick<
  Env,
  | 'RESEND_API_KEY'
  | 'BETTER_AUTH_SECRET'
  | 'BETTER_AUTH_URL'
  | 'EMAIL_FROM'
  | 'WEB_ORIGIN'
  | 'GOOGLE_CLIENT_ID'
  | 'GOOGLE_CLIENT_SECRET'
  | 'MICROSOFT_CLIENT_ID'
  | 'MICROSOFT_CLIENT_SECRET'
  | 'GITHUB_CLIENT_ID'
  | 'GITHUB_CLIENT_SECRET'
>;

/**
 * Cada proveedor social solo se activa si tiene AMBAS variables — así no
 * hace falta configurar los tres para usar uno solo (mismo criterio que las
 * API keys de extracción, constitution Principio VII). URL de redirección a
 * registrar en cada consola: `{BETTER_AUTH_URL}/callback/{proveedor}` — con
 * `basePath: '/auth'` de abajo, NO es `/api/auth/callback/...` como
 * muestran los ejemplos genéricos de la documentación de Better Auth.
 */
function construirProveedoresSociales(env: EnvParaAuth) {
  const proveedores: NonNullable<Parameters<typeof betterAuth>[0]['socialProviders']> = {};

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    // Google marca el correo como verificado en su propia respuesta OAuth —
    // Better Auth respeta esa afirmación, así que una cuenta creada por
    // Google entra directo, sin pasar por emailVerification de abajo
    // (verificado contra better-auth.com/docs/concepts/oauth, ago-2026).
    proveedores.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    };
  }

  if (env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET) {
    proveedores.microsoft = {
      clientId: env.MICROSOFT_CLIENT_ID,
      clientSecret: env.MICROSOFT_CLIENT_SECRET,
      // Microsoft manda la foto de perfil codificada en base64, que puede
      // exceder el límite de tamaño de un header HTTP — esta app no
      // muestra foto de perfil en ningún lado, así que se descarta en el
      // origen en vez de intentar guardarla (verificado contra el tipo
      // MicrosoftOptions instalado, no la documentación genérica).
      disableProfilePhoto: true,
      // A diferencia de Google, Microsoft (cuentas "managed"/de trabajo) no
      // siempre manda el claim de correo, y cuando lo manda no está
      // verificado por Microsoft mismo — puede quedar pendiente de
      // verificación igual que un registro por correo/contraseña.
    };
  }

  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    proveedores.github = {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      // Sin este scope explícito, GitHub no manda el correo en absoluto —
      // y aun con él, una cuenta con correo privado puede seguir sin
      // recibirlo (GET /user devuelve null): caso conocido, sin manejo
      // especial aquí todavía.
      scope: ['user:email'],
    };
  }

  return proveedores;
}

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
    socialProviders: construirProveedoresSociales(env),

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
        // Ahora hay cuentas creadas solo por Google/Microsoft/GitHub, que
        // nunca tuvieron contraseña — sin esto no podrían activar 2FA en
        // absoluto (default: false exige contraseña siempre que exista una
        // cuenta de credenciales, y estas cuentas no la tienen).
        allowPasswordless: true,
      }),
    ],
  });
}

export type Auth = ReturnType<typeof crearAuth>;
