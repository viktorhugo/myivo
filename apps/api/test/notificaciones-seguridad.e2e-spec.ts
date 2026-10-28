import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import express from 'express';
import { toNodeHandler } from 'better-auth/node';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { AUTH, type Auth } from '../src/modules/auth/auth';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Fase 0 ítem 4 (política de notificaciones) — el hook global `hooks.after`
 * de auth.ts ahora corre en TODA request de Better Auth, incluidas estas que
 * ya existían antes de esta feature (2FA, cambio de contraseña). Esta suite
 * es la regresión de que siguen funcionando igual con el hook puesto encima
 * — no verifica la entrega real del correo (Resend rechaza en sandbox
 * cualquier destino que no sea el propio del proyecto; igual que
 * sendVerificationEmail, nunca se mockeó en este repo). El mapeo ruta→asunto
 * en sí se testea aparte en auth.spec.ts, sin red.
 *
 * Primera cobertura de 2FA en este repo — README.md lo documentaba como
 * "pendiente de probar de punta a punta".
 */
describe('Regresión de 2FA/cambio de contraseña con el hook de notificaciones (Fase 0 ítem 4)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: Auth;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bodyParser: false });
    app.useGlobalFilters(new GlobalExceptionFilter());
    auth = app.get<Auth>(AUTH);
    app.getHttpAdapter().getInstance().all('/auth/*splat', toNodeHandler(auth));
    app.use(express.json());
    await app.init();

    prisma = app.get(PrismaService);
  });

  const usuariosCreados: string[] = [];

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: usuariosCreados } } });
    await app.close();
  });

  const contraseña = 'contraseña-de-prueba-suficientemente-larga';

  async function cuentaNuevaLogueada(): Promise<{ agente: ReturnType<typeof request.agent>; usuarioId: string }> {
    const correo = `notif-${randomUUID()}@myivo-test.local`;
    const { user } = await auth.api.signUpEmail({
      body: { name: 'Cuenta de prueba', email: correo, password: contraseña },
    });
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    usuariosCreados.push(user.id);

    const agente = request.agent(app.getHttpServer());
    await agente.post('/auth/sign-in/email').send({ email: correo, password: contraseña }).expect(200);

    return { agente, usuarioId: user.id };
  }

  it('activar 2FA con la contraseña correcta sigue funcionando (totpURI + backup codes)', async () => {
    const { agente } = await cuentaNuevaLogueada();

    const respuesta = await agente.post('/auth/two-factor/enable').send({ password: contraseña }).expect(200);

    expect(respuesta.body.totpURI).toContain('otpauth://totp/');
    expect(Array.isArray(respuesta.body.backupCodes)).toBe(true);
  });

  it('activar 2FA con la contraseña incorrecta no activa nada', async () => {
    const { agente, usuarioId } = await cuentaNuevaLogueada();

    await agente.post('/auth/two-factor/enable').send({ password: 'contraseña-equivocada' }).expect(400);

    const usuario = await prisma.user.findUniqueOrThrow({ where: { id: usuarioId } });
    expect(usuario.twoFactorEnabled).toBe(false);
  });

  it('desactivar 2FA con la contraseña correcta sigue funcionando', async () => {
    const { agente, usuarioId } = await cuentaNuevaLogueada();
    await agente.post('/auth/two-factor/enable').send({ password: contraseña }).expect(200);

    await agente.post('/auth/two-factor/disable').send({ password: contraseña }).expect(200);

    const usuario = await prisma.user.findUniqueOrThrow({ where: { id: usuarioId } });
    expect(usuario.twoFactorEnabled).toBe(false);
  });

  it('cambiar la contraseña con la actual correcta sigue funcionando y la nueva permite loguearse', async () => {
    const { agente } = await cuentaNuevaLogueada();
    const contraseñaNueva = 'otra-contraseña-de-prueba-suficientemente-larga';

    await agente
      .post('/auth/change-password')
      .send({ currentPassword: contraseña, newPassword: contraseñaNueva })
      .expect(200);

    const correoDeEsteAgente = (await agente.get('/auth/get-session')).body.user.email as string;
    await request
      .agent(app.getHttpServer())
      .post('/auth/sign-in/email')
      .send({ email: correoDeEsteAgente, password: contraseñaNueva })
      .expect(200);
  });
});
