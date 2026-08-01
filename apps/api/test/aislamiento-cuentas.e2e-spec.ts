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
import { DuplicateMatchingService } from '../src/modules/invoices/duplicate-matching.service';
import { FacturaRepository } from '../src/modules/invoices/factura.repository';

/**
 * specs/006-multi-usuario/tasks.md T016 — única excepción deliberada a "sin
 * tests en apps/api" (plan.md § Testing): el aislamiento entre cuentas es
 * "no negociable" (constitution Principio VII v2.0.0).
 *
 * Requiere una base de datos real, ya migrada (T004/T005) — no la ejecuta el
 * asistente, la ejecuta el usuario (acuerdo vigente toda la sesión) con
 * `pnpm --filter @myivo/api test` una vez que:
 * 1. `prisma migrate dev` (T004) ya corrió.
 * 2. `prisma/rls-policies.sql` (T005) ya está aplicado.
 * 3. La migración de columna obligatoria de seguimiento (ver el comentario
 *    en prisma/schema.prisma sobre Factura.usuarioId) también corrió.
 *
 * No usa las facturas de captura/extracción real (fotos, LLM) — inserta
 * filas de Factura directo por Prisma, con los campos mínimos que cada
 * aserción necesita. Lo que se prueba es la capa de aislamiento, no el
 * pipeline de extracción (ya cubierto manualmente en specs/001 a 005).
 */
describe('Aislamiento entre cuentas (specs/006-multi-usuario)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let txHost: TransactionHost<PrismaTransactionalAdapter>;
  let duplicateMatching: DuplicateMatchingService;
  let facturaRepository: FacturaRepository;

  let agenteA: ReturnType<typeof request.agent>;
  let agenteB: ReturnType<typeof request.agent>;
  let cuentaAId: string;
  let cuentaBId: string;
  const correoA = `cuenta-a-${randomUUID()}@myivo-test.local`;
  const correoB = `cuenta-b-${randomUUID()}@myivo-test.local`;
  const contraseña = 'contraseña-de-prueba-suficientemente-larga';

  const facturaIdsPorCuenta: Record<string, string[]> = {};

  /** Inserta una Factura mínima directo por Prisma, dentro de una transacción con app.usuario_id ya fijado — igual que lo haría el pipeline real. */
  async function crearFactura(
    usuarioId: string,
    datos: {
      comercioNombre: string;
      totalCentavos: number;
      fechaHoraCompra: Date;
      elegibilidadTributaria: boolean;
      cufe?: string;
      comercioNombreNormalizado?: string;
    },
  ): Promise<string> {
    const id = await aislarPorUsuario(txHost, usuarioId, async () => {
      const fila = await prisma.factura.create({
        data: {
          usuarioId,
          rutaImagenOriginal: `test/${randomUUID()}.jpg`,
          estado: 'extraida',
          comercioNombre: datos.comercioNombre,
          comercioNombreNormalizado: datos.comercioNombreNormalizado ?? null,
          totalCentavos: datos.totalCentavos,
          fechaHoraCompra: datos.fechaHoraCompra,
          moneda: 'COP',
          elegibilidadTributaria: datos.elegibilidadTributaria,
          cufe: datos.cufe ?? null,
        },
      });
      return fila.id;
    });
    (facturaIdsPorCuenta[usuarioId] ??= []).push(id);
    return id;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    // Misma secuencia de bootstrap que src/main.ts — el login real de este
    // test pasa por el mismo mount de Better Auth que producción.
    app = moduleRef.createNestApplication({ bodyParser: false });
    app.useGlobalFilters(new GlobalExceptionFilter());
    const auth = app.get<Auth>(AUTH);
    app.getHttpAdapter().getInstance().all('/auth/*splat', toNodeHandler(auth));
    app.use(express.json());
    await app.init();

    prisma = app.get(PrismaService);
    // Genérico explícito: app.get(TransactionHost) a secas infiere
    // TransactionHost<never> (el default de la clase) y rompe txHost.tx en
    // aislarPorUsuario — mismo motivo documentado en aislar-por-usuario.ts.
    txHost = app.get<TransactionHost<PrismaTransactionalAdapter>>(TransactionHost);
    duplicateMatching = app.get(DuplicateMatchingService);
    facturaRepository = app.get(FacturaRepository);

    // Cuentas ya verificadas, sin correo real — mismo patrón que
    // scripts/migrar-datos-existentes.ts (evita depender de Resend en el test).
    const { user: userA } = await auth.api.signUpEmail({
      body: { name: 'Cuenta A', email: correoA, password: contraseña },
    });
    const { user: userB } = await auth.api.signUpEmail({
      body: { name: 'Cuenta B', email: correoB, password: contraseña },
    });
    cuentaAId = userA.id;
    cuentaBId = userB.id;
    await prisma.user.update({ where: { id: cuentaAId }, data: { emailVerified: true } });
    await prisma.user.update({ where: { id: cuentaBId }, data: { emailVerified: true } });

    agenteA = request.agent(app.getHttpServer());
    agenteB = request.agent(app.getHttpServer());
    await agenteA.post('/auth/sign-in/email').send({ email: correoA, password: contraseña }).expect(200);
    await agenteB.post('/auth/sign-in/email').send({ email: correoB, password: contraseña }).expect(200);
  });

  afterAll(async () => {
    for (const [usuarioId, ids] of Object.entries(facturaIdsPorCuenta)) {
      await aislarPorUsuario(txHost, usuarioId, () =>
        prisma.factura.deleteMany({ where: { usuarioId, id: { in: ids } } }),
      );
    }
    // User/usuarios no tiene RLS (data-model.md § Aislamiento a dos capas) — delete directo.
    await prisma.user.deleteMany({ where: { id: { in: [cuentaAId, cuentaBId] } } });
    await app.close();
  });

  it('Listado: cada cuenta ve solo sus propias facturas (FR-004)', async () => {
    const facturaA = await crearFactura(cuentaAId, {
      comercioNombre: 'Ferretería Central',
      totalCentavos: 100_000,
      fechaHoraCompra: new Date('2026-03-01'),
      elegibilidadTributaria: true,
    });
    const facturaB = await crearFactura(cuentaBId, {
      comercioNombre: 'Papelería Norte',
      totalCentavos: 200_000,
      fechaHoraCompra: new Date('2026-03-02'),
      elegibilidadTributaria: true,
    });

    const respuestaA = await agenteA.get('/invoices').expect(200);
    const idsA = respuestaA.body.items.map((f: { id: string }) => f.id);
    expect(idsA).toContain(facturaA);
    expect(idsA).not.toContain(facturaB);

    const respuestaB = await agenteB.get('/invoices').expect(200);
    const idsB = respuestaB.body.items.map((f: { id: string }) => f.id);
    expect(idsB).toContain(facturaB);
    expect(idsB).not.toContain(facturaA);
  });

  it('Detalle: un id de la otra cuenta responde exactamente igual que un id inexistente (FR-005)', async () => {
    const facturaDeB = await crearFactura(cuentaBId, {
      comercioNombre: 'Solo de B',
      totalCentavos: 50_000,
      fechaHoraCompra: new Date('2026-03-03'),
      elegibilidadTributaria: false,
    });

    const respuestaIdAjeno = await agenteA.get(`/invoices/${facturaDeB}`);
    const respuestaIdInexistente = await agenteA.get(`/invoices/${randomUUID()}`);

    expect(respuestaIdAjeno.status).toBe(404);
    expect(respuestaIdAjeno.status).toBe(respuestaIdInexistente.status);

    // Mismo criterio para el endpoint individual de validación DIAN.
    const respuestaValidacionDian = await agenteA
      .post(`/invoices/${facturaDeB}/validaciones-dian`)
      .send({ resultado: 'valido_vigente' });
    expect(respuestaValidacionDian.status).toBe(404);
  });

  it('Duplicados: la misma compra capturada por dos cuentas no se marca como duplicado entre sí (FR-006)', async () => {
    const datosComunes = {
      comercioNombre: 'Supermercado Compartido',
      comercioNombreNormalizado: 'supermercado compartido',
      totalCentavos: 77_000,
      fechaHoraCompra: new Date('2026-03-04'),
      elegibilidadTributaria: true,
    };
    const facturaA = await crearFactura(cuentaAId, datosComunes);
    await crearFactura(cuentaBId, datosComunes);

    // Dispara la detección para la factura de A — si el aislamiento fallara,
    // encontraría la de B como candidata pese a ser cuentas distintas.
    await aislarPorUsuario(txHost, cuentaAId, () =>
      duplicateMatching.detectarYRegistrar(facturaA, cuentaAId),
    );

    const pendientesA = await agenteA.get('/invoices/duplicates/pending').expect(200);
    expect(pendientesA.body).toEqual([]);
  });

  it('Conciliación DIAN en lote: la lista de candidatas con CUFE nunca cruza cuentas (FR-004, FR-006)', async () => {
    const cufeA = `cufe-a-${randomUUID()}`;
    const cufeB = `cufe-b-${randomUUID()}`;
    await crearFactura(cuentaAId, {
      comercioNombre: 'Con CUFE de A',
      totalCentavos: 10_000,
      fechaHoraCompra: new Date('2026-03-05'),
      elegibilidadTributaria: true,
      cufe: cufeA,
    });
    await crearFactura(cuentaBId, {
      comercioNombre: 'Con CUFE de B',
      totalCentavos: 20_000,
      fechaHoraCompra: new Date('2026-03-06'),
      elegibilidadTributaria: true,
      cufe: cufeB,
    });

    const candidatasA = await aislarPorUsuario(txHost, cuentaAId, () =>
      facturaRepository.listarConCufe(cuentaAId),
    );
    expect(candidatasA.map((f) => f.cufe)).toContain(cufeA);
    expect(candidatasA.map((f) => f.cufe)).not.toContain(cufeB);
  });

  it('Reporte anual: el total elegible de cada cuenta refleja solo sus propias facturas (FR-004)', async () => {
    const anio = 2031; // año dedicado a este test, para no chocar con datos de otras aserciones
    await crearFactura(cuentaAId, {
      comercioNombre: 'Elegible de A',
      totalCentavos: 123_456,
      fechaHoraCompra: new Date(`${anio}-05-01`),
      elegibilidadTributaria: true,
    });
    await crearFactura(cuentaBId, {
      comercioNombre: 'Elegible de B',
      totalCentavos: 987_654,
      fechaHoraCompra: new Date(`${anio}-06-01`),
      elegibilidadTributaria: true,
    });

    const reporteA = await agenteA.get(`/reportes/anual?anio=${anio}`).expect(200);
    const reporteB = await agenteB.get(`/reportes/anual?anio=${anio}`).expect(200);

    expect(reporteA.body.totalCentavos).toBe(123_456);
    expect(reporteB.body.totalCentavos).toBe(987_654);
  });
});
