import { Injectable, Logger } from '@nestjs/common';
import type { ArchivoDerivado } from '@myivo/domain';
import { decodificarImagen } from '../extraction/image-decoder';
import { FacturaRepository } from './factura.repository';
import { FileStorageService } from './file-storage.service';

/** Identifica el derivado apto para navegador dentro de `Factura.derivados`. */
export const TIPO_TRANSFORMACION_WEB = 'web';

/** Ancho máximo del derivado: suficiente para revisar la foto en pantalla sin servir 3 MB por vista. */
const ANCHO_MAXIMO = 1600;
const CALIDAD_JPEG = 82;

export interface ImagenServible {
  contenido: Buffer;
  mimeType: string;
}

/**
 * Produce (y cachea) una rendición JPEG de la foto original para mostrarla en
 * el navegador. Es necesario porque las fotos de iPhone llegan en HEIC, un
 * formato que ningún navegador renderiza — sin esto la pantalla de detalle
 * nunca puede mostrar la factura.
 *
 * El original NUNCA se toca (constitution Principio I): el JPEG es un archivo
 * nuevo, registrado en `Factura.derivados` con su vínculo al original.
 */
@Injectable()
export class ImagenWebService {
  private readonly logger = new Logger(ImagenWebService.name);

  constructor(
    private readonly fileStorage: FileStorageService,
    private readonly facturaRepository: FacturaRepository,
  ) {}

  async obtenerParaNavegador(
    facturaId: string,
    rutaOriginal: string,
    derivados: readonly ArchivoDerivado[],
  ): Promise<ImagenServible> {
    const derivadoRegistrado = derivados.find((d) => d.tipoTransformacion === TIPO_TRANSFORMACION_WEB);
    if (derivadoRegistrado && (await this.fileStorage.existe(derivadoRegistrado.ruta))) {
      return { contenido: await this.fileStorage.leer(derivadoRegistrado.ruta), mimeType: 'image/jpeg' };
    }

    const original = await this.fileStorage.leer(rutaOriginal);
    const jpeg = await (await decodificarImagen(original))
      .rotate() // respeta la orientación EXIF; sin esto las fotos verticales salen acostadas
      .resize({ width: ANCHO_MAXIMO, withoutEnlargement: true })
      .jpeg({ quality: CALIDAD_JPEG })
      .toBuffer();

    const ruta = await this.fileStorage.guardarDerivado(
      rutaOriginal,
      TIPO_TRANSFORMACION_WEB,
      jpeg,
      '.jpg',
    );

    try {
      await this.facturaRepository.registrarDerivado(facturaId, {
        ruta,
        tipoTransformacion: TIPO_TRANSFORMACION_WEB,
        creadoEn: new Date(),
      });
    } catch (error) {
      // El archivo ya existe en disco; no poder anotarlo solo implica regenerarlo
      // la próxima vez, nunca perder la imagen ni fallar la petición en curso.
      this.logger.warn(
        `No se pudo registrar el derivado web de la factura ${facturaId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return { contenido: jpeg, mimeType: 'image/jpeg' };
  }
}
