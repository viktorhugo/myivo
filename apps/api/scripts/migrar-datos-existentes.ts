// specs/006-multi-usuario/tasks.md T010 — migración de DATOS (no de esquema),
// ejecución única. Crea la cuenta de Victor ya verificada (sin pasar por el
// flujo de registro normal) y asigna su usuarioId a todas las facturas que
// ya existían antes de esta feature (data-model.md § Migración).
//
// CÓMO EJECUTAR (lo ejecuta el usuario, nunca el asistente — acuerdo vigente
// toda la sesión):
// 1. `pnpm --filter @myivo/api exec prisma migrate dev --name multi_usuario`
//    (T004 — agrega Factura.usuarioId NULLABLE a propósito, ver el comentario
//    en schema.prisma; y las tablas de Better Auth).
// 2. Este script:
//    `pnpm --filter @myivo/api migrar:datos-existentes tu-correo-real@ejemplo.com "tu-contraseña-nueva"`
//    (la contraseña entre comillas si tiene espacios; considera borrar esta
//    línea de tu historial de shell después, o usar un prefijo con espacio
//    si tu shell lo ignora del historial). Vas a recibir un correo de
//    verificación real de Resend — puedes ignorarlo, este script ya marca la
//    cuenta como verificada directamente.
// 3. Migración de seguimiento — ahora que todas las facturas tienen
//    usuarioId, vuelve la columna obligatoria:
//    `pnpm --filter @myivo/api exec prisma migrate dev --name usuario_id_obligatorio`
//    (antes, edita schema.prisma: `usuarioId String` y `usuario User` sin
//    el `?` en ambas líneas del modelo Factura).
// 4. Las políticas RLS (T005, prisma/rls-policies.sql) — antes o después de
//    este script, no importa el orden: este script fija `app.usuario_id`
//    igual, así que funciona tanto si RLS ya está activo como si no.
//
// Requiere las mismas variables de entorno que la API (apps/api/.env) — este
// script las valida con el mismo envSchema, así que si la API arranca hoy,
// esto también debería correr sin configuración adicional.

import 'reflect-metadata';
import { config as cargarDotenv } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { crearAuth } from '../src/modules/auth/auth';
import { validateEnv } from '../src/config/env.schema';

cargarDotenv();

/** Mismo parseo que tenía el envSchema viejo para MIS_IDENTIFICACIONES — ya no vive ahí, se lee crudo solo aquí, una vez. */
function leerIdentificacionesLegacy(): string[] {
  const valor = process.env.MIS_IDENTIFICACIONES;
  if (!valor) {
    return [];
  }
  return valor
    .split(',')
    .map((identificacion) => identificacion.trim())
    .filter((identificacion) => identificacion.length > 0);
}

async function main(): Promise<void> {
  const [correo, contraseña] = process.argv.slice(2);
  if (!correo || !contraseña) {
    console.error(
      'Uso: pnpm --filter @myivo/api migrar:datos-existentes <correo> <contraseña>',
    );
    process.exitCode = 1;
    return;
  }

  const env = validateEnv(process.env);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });

  try {
    const auth = crearAuth(prisma, env);

    const resultado = await auth.api.signUpEmail({
      body: { name: 'Victor', email: correo, password: contraseña },
    });
    const usuarioId = resultado.user.id;

    const identificaciones = leerIdentificacionesLegacy();
    await prisma.user.update({
      where: { id: usuarioId },
      data: {
        emailVerified: true,
        identificacionesTributarias: identificaciones,
      },
    });
    console.log(
      `Cuenta creada y verificada: ${correo} (identificaciones tributarias migradas: ${
        identificaciones.length > 0 ? identificaciones.join(', ') : '(ninguna encontrada en MIS_IDENTIFICACIONES)'
      }).`,
    );

    // set_config, no una simple actualización — para que funcione igual si
    // las políticas RLS (T005) ya están activas o no todavía (ver punto 4
    // del encabezado). is_local=true limita el valor a esta transacción.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.usuario_id', ${usuarioId}, true)`;
      const { count } = await tx.factura.updateMany({
        where: { usuarioId: null },
        data: { usuarioId },
      });
      console.log(`${count} factura(s) existente(s) asignada(s) a la cuenta ${correo}.`);
    });

    console.log(
      'Listo. Antes de usar la app: aplica la migración de seguimiento del punto 3 del encabezado de este script (vuelve Factura.usuarioId obligatoria).',
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('La migración de datos falló:', error);
  process.exitCode = 1;
});
