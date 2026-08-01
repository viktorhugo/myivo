import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ClsModule } from 'nestjs-cls';
import { ClsPluginTransactional, type TransactionalAdapter } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { AppController } from './app.controller';
import { validateEnv } from './config/env.schema';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';
import { AuthModule } from './modules/auth/auth.module';
import { RlsTransactionInterceptor } from './modules/auth/rls-transaction.interceptor';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { ExtractionModule } from './modules/extraction/extraction.module';
import { ValidacionDianModule } from './modules/validacion-dian/validacion-dian.module';
import { ReportesModule } from './modules/reportes/reportes.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    // global + middleware.mount: sin esto ningún request tiene contexto CLS,
    // y rls-transaction.interceptor.ts no podría usar TransactionHost
    // (research.md § 3).
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
      plugins: [
        new ClsPluginTransactional({
          imports: [PrismaModule],
          // `as TransactionalAdapter<...>`: el propio tipo de la librería
          // declara `wrapWithNestedTransaction` como `(...) => ... |
          // undefined` (función completa opcional), pero la interfaz base la
          // marca `?:` sin `| undefined` explícito — choque de forma con
          // `exactOptionalPropertyTypes`, no una incompatibilidad real en
          // runtime (mismo tipo de fricción ya visto en este proyecto con
          // AbortSignal). No hay versión más nueva del adaptador (1.3.5 es
          // la última) que lo corrija.
          adapter: new TransactionalAdapterPrisma({
            prismaInjectionToken: PrismaService,
            sqlFlavor: 'postgresql',
          }) as TransactionalAdapter<unknown, unknown, unknown>,
          // Sin esto, los repositorios existentes (que inyectan PrismaService
          // directo, p. ej. `this.prisma.factura...`) nunca verían la
          // transacción activa — solo el proxy inyectado vía
          // @InjectTransaction() (repositorios) o TransactionHost.tx
          // (extraction.processor.ts, que abre su propia transacción fuera
          // del ciclo de request) la usan de verdad.
          enableTransactionProxy: true,
        }),
      ],
    }),
    PrismaModule,
    AuthModule,
    InvoicesModule,
    ExtractionModule,
    ValidacionDianModule,
    ReportesModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_INTERCEPTOR, useClass: RlsTransactionInterceptor }],
})
export class AppModule {}
