import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import type { Env } from '../../config/env.schema';

@Injectable()
export class FileStorageService {
  private readonly basePath: string;

  constructor(private readonly configService: ConfigService<Env, true>) {
    this.basePath = resolve(this.configService.get('IMAGE_STORAGE_PATH', { infer: true }));
  }

  /**
   * Guarda el archivo con un nombre único (UUID) — nunca sobrescribe un
   * original existente (constitution Principio I, FR-005). `wx` hace que la
   * escritura falle si, por cualquier motivo, el archivo ya existiera.
   */
  async guardarOriginal(nombreOriginal: string, contenido: Buffer): Promise<string> {
    await mkdir(this.basePath, { recursive: true });
    const extension = extname(nombreOriginal) || '.jpg';
    const nombreUnico = `${randomUUID()}${extension}`;
    const rutaAbsoluta = join(this.basePath, nombreUnico);

    await writeFile(rutaAbsoluta, contenido, { flag: 'wx' });

    return rutaAbsoluta;
  }

  /**
   * Guarda un archivo derivado (constitution Principio I: toda transformación
   * produce un archivo NUEVO, nunca sobrescribe el original). El nombre se
   * deriva del original más el sufijo de la transformación, para que la
   * relación entre ambos sea evidente en el propio filesystem.
   */
  async guardarDerivado(
    rutaOriginal: string,
    tipoTransformacion: string,
    contenido: Buffer,
    extension: string,
  ): Promise<string> {
    await mkdir(this.basePath, { recursive: true });
    const nombreBase = basename(rutaOriginal, extname(rutaOriginal));
    const rutaAbsoluta = join(this.basePath, `${nombreBase}.${tipoTransformacion}${extension}`);
    await writeFile(rutaAbsoluta, contenido);
    return rutaAbsoluta;
  }

  async existe(ruta: string): Promise<boolean> {
    try {
      await access(ruta);
      return true;
    } catch {
      return false;
    }
  }

  leer(ruta: string): Promise<Buffer> {
    return readFile(ruta);
  }
}
