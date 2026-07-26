import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import type { CorreccionManual, Factura, ItemFactura } from '@myivo/domain';
import type { Response } from 'express';
import type { Env } from '../../config/env.schema';
import { mimeTypeDeArchivo } from '../../common/mime';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { ExtractionProcessor } from '../extraction/extraction.processor';
import { corregirCamposSchema, normalizarCorrecciones } from './dto/corregir-campos.dto';
import { FacturaRepository } from './factura.repository';
import { FileStorageService } from './file-storage.service';

export interface FacturaDetalle extends Factura {
  items: ItemFactura[];
  correcciones: CorreccionManual[];
}

@Controller('invoices')
@UseGuards(SessionAuthGuard)
export class InvoicesController {
  private readonly logger = new Logger(InvoicesController.name);

  private readonly identificacionesPropias: readonly string[];

  constructor(
    private readonly facturaRepository: FacturaRepository,
    private readonly fileStorage: FileStorageService,
    private readonly extractionProcessor: ExtractionProcessor,
    configService: ConfigService<Env, true>,
  ) {
    this.identificacionesPropias = configService.get('MIS_IDENTIFICACIONES', { infer: true });
  }

  /**
   * Guarda cada imagen de inmediato y crea una Factura en `recibida` por
   * archivo, de forma independiente entre sí (FR-001/FR-002/FR-003). La
   * extracción (US2) se despacha de inmediato pero SIN esperar su resultado
   * — un fallo de extracción posterior nunca afecta esta respuesta.
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
      const factura = await this.facturaRepository.crear(ruta);
      facturas.push(factura);

      this.extractionProcessor.procesar(factura.id).catch((error: unknown) => {
        this.logger.error(
          `Despacho de extracción falló para factura ${factura.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      });
    }
    return facturas;
  }

  /** Detalle completo: campos extraídos, confianzaCampos, ítems y correcciones previas (FR-024). */
  @Get(':id')
  async obtener(@Param('id') id: string): Promise<FacturaDetalle> {
    const factura = await this.facturaRepository.obtenerPorId(id);
    if (!factura) {
      throw new NotFoundException(`Factura ${id} no encontrada`);
    }

    const [items, correcciones] = await Promise.all([
      this.facturaRepository.obtenerItems(id),
      this.facturaRepository.obtenerCorrecciones(id),
    ]);

    return { ...factura, items, correcciones };
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

  /**
   * Corrige uno o más campos extraídos (FR-011/FR-012). Cada corrección crea
   * su propio registro `CorreccionManual`, diferenciado del valor extraído.
   */
  @Patch(':id/fields')
  async corregirCampos(
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<FacturaDetalle> {
    const correcciones = normalizarCorrecciones(corregirCamposSchema.parse(body));

    for (const correccion of correcciones) {
      await this.facturaRepository.aplicarCorreccion(
        id,
        correccion.campo,
        correccion.valorCorregido,
        this.identificacionesPropias,
      );
    }

    return this.obtener(id);
  }

  /** Reintenta la extracción para una factura en `fallida` (FR-013). No aplica a otros estados. */
  @Post(':id/reprocess')
  async reprocesar(@Param('id') id: string): Promise<Factura> {
    const factura = await this.facturaRepository.obtenerPorId(id);
    if (!factura) {
      throw new NotFoundException(`Factura ${id} no encontrada`);
    }
    if (factura.estado !== 'fallida') {
      throw new BadRequestException(
        `Solo se puede reprocesar una factura en estado "fallida" (actual: "${factura.estado}")`,
      );
    }

    await this.extractionProcessor.procesar(id);

    const actualizada = await this.facturaRepository.obtenerPorId(id);
    if (!actualizada) {
      throw new NotFoundException(`Factura ${id} no encontrada`);
    }
    return actualizada;
  }
}
