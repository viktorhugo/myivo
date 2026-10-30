import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TransactionHost } from '@nestjs-cls/transactional';
import request from 'supertest';
import express from 'express';
import { toNodeHandler } from 'better-auth/node';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { AUTH, type Auth } from '../src/modules/auth/auth';
import { aislarPorUsuario, type PrismaTransactionalAdapter } from '../src/modules/auth/aislar-por-usuario';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * specs/008-borrado-cuenta — igual que aislamiento-cuentas.e2e-spec.ts, es
 * una excepción deliberada a "sin tests en apps/api" (constitution Principio
 * VIII): el borrado de cuenta ahora toca la única excepción permitida al
 * Principio I (v2.1.0), así que su comportamiento exacto es no negociable.
 *
 * Requiere una base de datos real ya migrada — ver el mismo comentario en
 * aislamiento-cuentas.e2e-spec.ts sobre quién corre `pnpm test`.
 */
describe('Borrado de cuenta con purga diferida (specs/008-borrado-cuenta)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let txHost: TransactionHost<PrismaTransactionalAdapter>;
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
    txHost = app.get<TransactionHost<PrismaTransactionalAdapter>>(TransactionHost);
  });

  const usuariosCreados: string[] = [];

  afterAll(async () => {
    // Facturas primero (D5 en research.md: la FK no tiene onDelete: Cascade a propósito).
    await prisma.factura.deleteMany({ where: { usuarioId: { in: usuariosCreados } } });
    await prisma.user.deleteMany({ where: { id: { in: usuariosCreados } } });
    await app.close();
  });

  const contraseña = 'contraseña-de-prueba-suficientemente-larga';

  /** Registra una cuenta nueva, la marca verificada (igual que el patrón de aislamiento-cuentas), y devuelve un agente ya logueado. */
  async function cuentaNuevaLogueada(): Promise<{
    agente: ReturnType<typeof request.agent>;
    usuarioId: string;
    correo: string;
  }> {
    const correo = `eliminacion-${randomUUID()}@cufeo-test.local`;
    const { user } = await auth.api.signUpEmail({
      body: { name: 'Cuenta de prueba', email: correo, password: contraseña },
    });
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    usuariosCreados.push(user.id);

    const agente = request.agent(app.getHttpServer());
    await agente.post('/auth/sign-in/email').send({ email: correo, password: contraseña }).expect(200);

    return { agente, usuarioId: user.id, correo };
  }

  describe('US1 — Borrado inmediato (FR-001 a FR-003, FR-011)', () => {
    it('POST /cuenta/eliminacion con el correo correcto bloquea la cuenta al instante', async () => {
      const { agente, correo } = await cuentaNuevaLogueada();

      const respuesta = await agente.post('/cuenta/eliminacion').send({ correoConfirmacion: correo }).expect(200);

      const programadaPara = new Date(respuesta.body.eliminacionProgramadaPara);
      const esperado = Date.now() + 30 * 24 * 60 * 60 * 1000;
      expect(Math.abs(programadaPara.getTime() - esperado)).toBeLessThan(60_000); // tolerancia de 1 minuto

      // La misma sesión que pidió el borrado queda sin acceso de inmediato
      // (403: mismo comportamiento ya establecido de SessionUsuarioGuard
      // cuando canActivate devuelve false, no 401 — default de NestJS).
      await agente.get('/invoices').expect(403);
    });

    it('POST /cuenta/eliminacion con un correo de confirmación incorrecto no cambia nada', async () => {
      const { agente } = await cuentaNuevaLogueada();

      await agente.post('/cuenta/eliminacion').send({ correoConfirmacion: 'no-es-mi-correo@otro.com' }).expect(400);

      // La cuenta sigue activa — la misma sesión puede seguir operando.
      await agente.get('/invoices').expect(200);
    });

    it('una segunda solicitud sobre una cuenta ya con eliminación programada responde 409 sin reiniciar el plazo', async () => {
      const { agente, correo } = await cuentaNuevaLogueada();

      const primera = await agente.post('/cuenta/eliminacion').send({ correoConfirmacion: correo }).expect(200);
      const fechaOriginal = primera.body.eliminacionProgramadaPara;

      // La sesión que hizo la primera solicitud ya fue revocada — probamos con una sesión nueva
      // (mismas credenciales siguen siendo válidas a nivel de Better Auth, D3).
      const agenteNuevo = request.agent(app.getHttpServer());
      await agenteNuevo.post('/auth/sign-in/email').send({ email: correo, password: contraseña }).expect(200);

      const segunda = await agenteNuevo
        .post('/cuenta/eliminacion')
        .send({ correoConfirmacion: correo })
        .expect(409);

      expect(segunda.body.details.eliminacionProgramadaPara).toBe(fechaOriginal);
    });
  });

  describe('US2 — Revertir dentro de la ventana (FR-005)', () => {
    it('GET /cuenta/eliminacion informa el estado — null en una cuenta activa, la fecha en una programada', async () => {
      const activa = await cuentaNuevaLogueada();
      const estadoActivo = await activa.agente.get('/cuenta/eliminacion').expect(200);
      expect(estadoActivo.body.eliminacionProgramadaPara).toBeNull();

      const { agente, correo } = await cuentaNuevaLogueada();
      await agente.post('/cuenta/eliminacion').send({ correoConfirmacion: correo }).expect(200);

      const agenteNuevo = request.agent(app.getHttpServer());
      await agenteNuevo.post('/auth/sign-in/email').send({ email: correo, password: contraseña }).expect(200);
      const estadoProgramada = await agenteNuevo.get('/cuenta/eliminacion').expect(200);
      expect(estadoProgramada.body.eliminacionProgramadaPara).not.toBeNull();
    });

    it('POST /cuenta/eliminacion/cancelar revierte el borrado sin perder las facturas existentes', async () => {
      const { agente, usuarioId, correo } = await cuentaNuevaLogueada();

      await aislarPorUsuario(txHost, usuarioId, () =>
        prisma.factura.create({
          data: {
            usuarioId,
            rutaImagenOriginal: `test/${randomUUID()}.jpg`,
            estado: 'recibida',
            moneda: 'COP',
          },
        }),
      );

      await agente.post('/cuenta/eliminacion').send({ correoConfirmacion: correo }).expect(200);

      const agenteNuevo = request.agent(app.getHttpServer());
      await agenteNuevo.post('/auth/sign-in/email').send({ email: correo, password: contraseña }).expect(200);

      const cancelacion = await agenteNuevo.post('/cuenta/eliminacion/cancelar').expect(200);
      expect(cancelacion.body.eliminacionProgramadaPara).toBeNull();

      const facturas = await agenteNuevo.get('/invoices').expect(200);
      expect(facturas.body.items).toHaveLength(1);
    });

    it('POST /cuenta/eliminacion/cancelar sobre una cuenta activa (sin nada que cancelar) responde 409', async () => {
      const { agente } = await cuentaNuevaLogueada();

      await agente.post('/cuenta/eliminacion/cancelar').expect(409);
    });
  });
});
