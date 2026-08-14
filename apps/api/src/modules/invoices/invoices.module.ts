import { forwardRef, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import type { Env } from '../../config/env.schema';
import { ExtractionModule } from '../extraction/extraction.module';
import { InvoicesController } from './invoices.controller';
import { DuplicateMatchingService } from './duplicate-matching.service';
import { FacturaRepository } from './factura.repository';
import { FileStorageService } from './file-storage.service';
import { ImagenWebService } from './imagen-web.service';

@Module({
  imports: [
    forwardRef(() => ExtractionModule),
    // Límites de subida (FR-012/FR-013) — FilesInterceptor('files'), sin
    // opciones propias en el controller, inyecta MULTER_MODULE_OPTIONS de
    // acá (@nestjs/platform-express/multer/interceptors/files.interceptor.js)
    // cuando el módulo que lo declara importa MulterModule.
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Env, true>) => ({
        limits: {
          fileSize: configService.get('UPLOAD_MAX_FILE_SIZE_MB', { infer: true }) * 1024 * 1024,
          files: configService.get('UPLOAD_MAX_FILES_PER_BATCH', { infer: true }),
        },
      }),
    }),
  ],
  controllers: [InvoicesController],
  providers: [FacturaRepository, FileStorageService, DuplicateMatchingService, ImagenWebService],
  exports: [FacturaRepository, FileStorageService, DuplicateMatchingService],
})
export class InvoicesModule {}
