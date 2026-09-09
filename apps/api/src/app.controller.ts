import { Controller, Get } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { PrismaService } from './prisma/prisma.service';

interface UltimoRespaldo {
  fecha: string;
  resultado: 'ok' | 'fallido';
  mensaje?: string;
}

interface RespuestaSalud {
  status: 'ok';
  baseDeDatos: 'ok' | 'error';
  ultimoRespaldo: UltimoRespaldo | null;
}

/**
 * `scripts/backup-db.sh` corre en el host y escribe acá — `docker-compose.yml`
 * monta `./backups` de solo lectura en este contenedor bajo `/backups`
 * (FR-021, specs/007-despliegue-produccion/research.md § 13).
 */
const RUTA_ESTADO_RESPALDO = '/backups/ultimo-estado.json';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Público, sin `SessionUsuarioGuard` (US8) — es la herramienta de
   * diagnóstico para cuando algo más ya está roto, incluido el login mismo.
   * `status` siempre es "ok" mientras el proceso HTTP responda; `baseDeDatos`
   * refleja el estado real de la conexión — así se puede diferenciar "la API
   * no responde" de "la API responde pero la BD está caída" (FR-027).
   */
  @Get('health')
  async health(): Promise<RespuestaSalud> {
    const [baseDeDatos, ultimoRespaldo] = await Promise.all([
      this.verificarBaseDeDatos(),
      this.leerUltimoRespaldo(),
    ]);

    return { status: 'ok', baseDeDatos, ultimoRespaldo };
  }

  private async verificarBaseDeDatos(): Promise<'ok' | 'error'> {
    try {
      // Consulta trivial, sin RLS: este endpoint no tiene sesión de usuario
      // (aislar-por-usuario.ts no aplica) — solo confirma que la conexión
      // funciona, no lee datos de ninguna cuenta.
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'error';
    }
  }

  /** `null` si el archivo todavía no existe (instalación recién hecha, nunca corrió un respaldo) — no es un error. */
  private async leerUltimoRespaldo(): Promise<UltimoRespaldo | null> {
    try {
      const contenido = await readFile(RUTA_ESTADO_RESPALDO, 'utf-8');
      return JSON.parse(contenido) as UltimoRespaldo;
    } catch {
      return null;
    }
  }
}
