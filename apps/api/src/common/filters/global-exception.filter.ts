import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';

interface ResolvedError {
  statusCode: number;
  message: string;
  details?: unknown;
}

/**
 * `FilesInterceptor` ya traduce los errores de Multer a `HttpException`
 * (@nestjs/platform-express/multer/multer/multer.utils.js): `LIMIT_FILE_SIZE`
 * → `PayloadTooLargeException`, `LIMIT_FILE_COUNT` → `BadRequestException` —
 * ambos con el texto en inglés propio de Multer ("File too large", "Too many
 * files"). Sin este mapa caerían en el branch genérico de HttpException de
 * abajo con ese texto tal cual — técnicamente un mensaje claro (FR-012/013),
 * pero inconsistente con el resto de la app, que es toda en español.
 */
const MENSAJE_POR_ERROR_DE_MULTER: Record<string, string> = {
  'File too large': 'El archivo excede el tamaño máximo permitido por subida.',
  'Too many files': 'El lote excede la cantidad máxima de archivos permitida por subida.',
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message, details } = this.resolveError(exception);

    this.logger.error(
      `${request.method} ${request.url} -> ${statusCode}: ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(statusCode).json({
      statusCode,
      message,
      ...(details ? { details } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private resolveError(exception: unknown): ResolvedError {
    if (exception instanceof ZodError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Datos de entrada inválidos',
        details: exception.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      };
    }

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : ((body as { message?: string | string[] }).message ?? exception.message);
      const mensajeFinal = Array.isArray(message) ? message.join(', ') : message;
      return {
        statusCode: exception.getStatus(),
        message: MENSAJE_POR_ERROR_DE_MULTER[mensajeFinal] ?? mensajeFinal,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Error interno del servidor',
    };
  }
}
