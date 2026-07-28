import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { validateEnv } from './config/env.schema';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { ExtractionModule } from './modules/extraction/extraction.module';
import { ValidacionDianModule } from './modules/validacion-dian/validacion-dian.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    PrismaModule,
    AuthModule,
    InvoicesModule,
    ExtractionModule,
    ValidacionDianModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
