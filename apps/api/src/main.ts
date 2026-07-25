import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import session from 'express-session';
import { AppModule } from './app.module';
import type { Env } from './config/env.schema';
import { JsonLoggerService } from './common/logger/json-logger.service';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: new JsonLoggerService(),
  });
  const configService = app.get<ConfigService<Env, true>>(ConfigService);

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.use(
    session({
      secret: configService.get('SESSION_SECRET', { infer: true }),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: configService.get('NODE_ENV', { infer: true }) === 'production',
        sameSite: 'strict',
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 días
      },
    }),
  );

  const port = configService.get('PORT', { infer: true });
  await app.listen(port);
}

void bootstrap();
