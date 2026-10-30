import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { AUTH, type Auth } from '../src/modules/auth/auth';
import { aislarPorUsuario } from '../src/modules/auth/aislar-por-usuario';
import type { PrismaTransactionalAdapter } from '../src/modules/auth/aislar-por-usuario';
import { TransactionHost } from '@nestjs-cls/transactional';
import { PrismaService } from '../src/prisma/prisma.service';
import { FileStorageService } from '../src/modules/invoices/file-storage.service';
import { PurgaCuentasService } from '../src/modules/purga-cuentas/purga-cuentas.service';

/**
 * specs/008-borrado-cuenta (US3) — igual que los otros dos *.e2e-spec.ts de
 * este feature, excepción deliberada a "sin tests en apps/api": la purga es
 * irreversible por diseño, así que su comportamiento exacto (qué destruye,
 * en qué orden, y que sea segura de repetir) es no negociable.
 *
 * No pasa por HTTP — `PurgaCuentasService` se resuelve directo del
 * contenedor de Nest, igual que lo invoca el comando standalone real
 * (scripts/purgar-cuentas-eliminadas.ts).
 */
describe('Purga de cuentas eliminadas (specs/008-borrado-cuenta, US3)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let txHost: TransactionHost<PrismaTransactionalAdapter>;
  let auth: Auth;
  let fileStorage: FileStorageService;
  let purgaCuentas: PurgaCuentasService;

  const usuariosCreados: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    txHost = app.get<TransactionHost<PrismaTransactionalAdapter>>(TransactionHost);
    auth = app.get<Auth>(AUTH);
    fileStorage = app.get(FileStorageService);
    purgaCuentas = app.get(PurgaCuentasService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: usuariosCreados } } });
    await app.close();
  });

  /** Registra una cuenta con eliminación programada ya vencida (simula el paso de 30 días sin reversión). */
  async function cuentaConEliminacionVencida(): Promise<string> {
    const correo = `purga-${randomUUID()}@cufeo-test.local`;
    const { user } = await auth.api.signUpEmail({
      body: { name: 'Cuenta a purgar', email: correo, password: 'contraseña-de-prueba-suficiente' },
    });
    usuariosCreados.push(user.id);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        eliminacionSolicitadaEn: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
        eliminacionProgramadaPara: new Date(Date.now() - 24 * 60 * 60 * 1000), // ayer — ya vencida
      },
    });
    return user.id;
  }

  it('destruye el archivo original, la Factura y el User de una cuenta vencida (FR-006, FR-007)', async () => {
    const usuarioId = await cuentaConEliminacionVencida();
    const rutaOriginal = await fileStorage.guardarOriginal(
      `prueba-${randomUUID()}.jpg`,
      Buffer.from('contenido de prueba'),
    );
    await aislarPorUsuario(txHost, usuarioId, () =>
      prisma.factura.create({
        data: { usuarioId, rutaImagenOriginal: rutaOriginal, estado: 'recibida', moneda: 'COP' },
      }),
    );

    await purgaCuentas.ejecutarPurga();

    expect(await fileStorage.existe(rutaOriginal)).toBe(false);
    const facturasRestantes = await aislarPorUsuario(txHost, usuarioId, () =>
      prisma.factura.findMany({ where: { usuarioId } }),
    );
    expect(facturasRestantes).toHaveLength(0);
    await expect(prisma.user.findUniqueOrThrow({ where: { id: usuarioId } })).rejects.toThrow();
  });

  it('correr la purga dos veces sobre el mismo estado no falla ni cambia nada más (FR-010, idempotencia)', async () => {
    const usuarioId = await cuentaConEliminacionVencida();
    const rutaOriginal = await fileStorage.guardarOriginal(
      `prueba-${randomUUID()}.jpg`,
      Buffer.from('contenido de prueba'),
    );
    await aislarPorUsuario(txHost, usuarioId, () =>
      prisma.factura.create({
        data: { usuarioId, rutaImagenOriginal: rutaOriginal, estado: 'recibida', moneda: 'COP' },
      }),
    );

    await purgaCuentas.ejecutarPurga();
    // Segunda corrida — la cuenta ya no existe, así que ni siquiera debería
    // volver a intentar purgarla, pero el comando como un todo no debe fallar.
    await expect(purgaCuentas.ejecutarPurga()).resolves.not.toThrow();

    await expect(prisma.user.findUniqueOrThrow({ where: { id: usuarioId } })).rejects.toThrow();
  });

  it('no toca una cuenta cuya eliminación todavía no venció', async () => {
    const correo = `purga-vigente-${randomUUID()}@cufeo-test.local`;
    const { user } = await auth.api.signUpEmail({
      body: { name: 'Cuenta vigente', email: correo, password: 'contraseña-de-prueba-suficiente' },
    });
    usuariosCreados.push(user.id);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        eliminacionSolicitadaEn: new Date(),
        eliminacionProgramadaPara: new Date(Date.now() + 29 * 24 * 60 * 60 * 1000), // todavía dentro de la ventana
      },
    });

    await purgaCuentas.ejecutarPurga();

    await expect(prisma.user.findUniqueOrThrow({ where: { id: user.id } })).resolves.toBeDefined();
  });
});
