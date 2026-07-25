import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
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

  leer(ruta: string): Promise<Buffer> {
    return readFile(ruta);
  }
}
