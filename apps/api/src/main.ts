import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import express from 'express';
import { toNodeHandler } from 'better-auth/node';
import { AppModule } from './app.module';
import type { Env } from './config/env.schema';
import { JsonLoggerService } from './common/logger/json-logger.service';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { AUTH, type Auth } from './modules/auth/auth';

async function bootstrap(): Promise<void> {
  // bodyParser: false — Better Auth necesita el body crudo, sin parsear
  // (contracts/api.md § Autenticación). express.json() se agrega más abajo,
  // después de montar el handler de Better Auth, para el resto de rutas.
  const app = await NestFactory.create(AppModule, {
    logger: new JsonLoggerService(),
    bodyParser: false,
  });
  const configService = app.get<ConfigService<Env, true>>(ConfigService);

  app.useGlobalFilters(new GlobalExceptionFilter());

  const auth = app.get<Auth>(AUTH);
  // Sin prefijo /api: el proxy de Vite (apps/web/vite.config.ts) ya lo quita
  // antes de reenviar al backend — igual que cualquier otro @Controller() de
  // este proyecto (p. ej. InvoicesController vive en /invoices, no
  // /api/invoices). Express 5 (path-to-regexp v6+): el wildcard sin nombre
  // "*" ya no es válido, hace falta "*splat".
  app.getHttpAdapter().getInstance().all('/auth/*splat', toNodeHandler(auth));

  app.use(express.json());

  const port = configService.get('PORT', { infer: true });
  await app.listen(port);
}

void bootstrap();
