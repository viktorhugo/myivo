// specs/008-borrado-cuenta (US3, D4 en research.md) — comando standalone,
// disparado por cron del sistema operativo una vez al día (ver
// scripts/purgar-cuentas-eliminadas.sh y README.md § Despliegue), nunca por
// un scheduler en proceso (sin precedente en este proyecto — el patrón
// establecido es cron del host + script, igual que scripts/backup-db.sh).
//
// A diferencia de scripts/migrar-datos-existentes.ts (PrismaClient crudo),
// este SÍ arranca el contexto completo de Nest: PurgaCuentasService necesita
// la misma plomería transaccional/RLS (aislarPorUsuario vía TransactionHost)
// que usa el resto de la app — reimplementarla a mano acá sería duplicar
// lógica ya correcta, no simplificarla.
//
// CÓMO EJECUTAR: `pnpm --filter @myivo/api purgar:cuentas-eliminadas`.

import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PurgaCuentasService } from '../src/modules/purga-cuentas/purga-cuentas.service';

async function main(): Promise<void> {
  const logger = new Logger('PurgarCuentasEliminadas');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  try {
    const purgaCuentas = app.get(PurgaCuentasService);
    const purgadas = await purgaCuentas.ejecutarPurga();
    logger.log(`Purga completada: ${purgadas} cuenta(s) destruida(s) de forma irreversible.`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error('El comando de purga falló:', error);
  process.exitCode = 1;
});
