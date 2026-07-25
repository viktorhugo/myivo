import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Factura } from '@myivo/domain';
import type { Response } from 'express';
import { mimeTypeDeArchivo } from '../../common/mime';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { FacturaRepository } from './factura.repository';
import { FileStorageService } from './file-storage.service';

@Controller('invoices')
@UseGuards(SessionAuthGuard)
export class InvoicesController {
  constructor(
    private readonly facturaRepository: FacturaRepository,
    private readonly fileStorage: FileStorageService,
  ) {}

  /**
   * Guarda cada imagen de inmediato y crea una Factura en `recibida` por
   * archivo, de forma independiente entre sí (FR-001/FR-002/FR-003).
   */
  @Post()
  @UseInterceptors(FilesInterceptor('files'))
  async subir(@UploadedFiles() files: Express.Multer.File[]): Promise<Factura[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('Debes adjuntar al menos un archivo');
    }

    const facturas: Factura[] = [];
    for (const file of files) {
      const ruta = await this.fileStorage.guardarOriginal(file.originalname, file.buffer);
      facturas.push(await this.facturaRepository.crear(ruta));
    }
    return facturas;
  }

  @Get(':id')
  async obtener(@Param('id') id: string): Promise<Factura> {
    const factura = await this.facturaRepository.obtenerPorId(id);
    if (!factura) {
      throw new NotFoundException(`Factura ${id} no encontrada`);
    }
    return factura;
  }

  /**
   * Sirve el byte-stream original sin importar el `estado` de la factura —
   * el fallo de un procesamiento posterior nunca implica pérdida del archivo.
   */
  @Get(':id/image')
  async imagen(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const factura = await this.facturaRepository.obtenerPorId(id);
    if (!factura) {
      throw new NotFoundException(`Factura ${id} no encontrada`);
    }

    const contenido = await this.fileStorage.leer(factura.rutaImagenOriginal);
    res.setHeader('Content-Type', mimeTypeDeArchivo(factura.rutaImagenOriginal));
    res.send(contenido);
  }
}
