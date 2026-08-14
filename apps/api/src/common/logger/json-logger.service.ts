import { Injectable, LoggerService, LogLevel } from '@nestjs/common';

@Injectable()
export class JsonLoggerService implements LoggerService {
  log(message: unknown, context?: string): void {
    this.write('log', message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write('error', message, context, trace);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('verbose', message, context);
  }

  private write(level: LogLevel, message: unknown, context?: string, trace?: string): void {
    const traceFinal = trace ?? (message instanceof Error ? message.stack : undefined);
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message: this.resolverMensaje(message),
      ...(traceFinal !== undefined ? { trace: traceFinal } : {}),
    };
    const line = `${JSON.stringify(entry)}\n`;
    if (level === 'error') {
      process.stderr.write(line);
    } else {
      process.stdout.write(line);
    }
  }

  /**
   * `JSON.stringify(error)` sobre un `Error` da `{}` — `.message` no es una
   * propiedad propia enumerable. Sin este caso especial, cualquier error
   * lanzado antes de tener un request HTTP que pase por
   * GlobalExceptionFilter (p. ej. `validateEnv()` fallando al arranque,
   * FR-005) se registraba como un objeto vacío, sin el mensaje claro que el
   * propio error ya traía.
   */
  private resolverMensaje(message: unknown): string {
    if (typeof message === 'string') {
      return message;
    }
    if (message instanceof Error) {
      return message.message;
    }
    return JSON.stringify(message);
  }
}
