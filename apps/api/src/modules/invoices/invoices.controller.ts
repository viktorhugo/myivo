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
  Query,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import type { CorreccionManual, Factura, ItemFactura, MarcaPosibleDuplicado } from '@myivo/domain';
import type { Response } from 'express';
import type { Env } from '../../config/env.schema';
import { mimeTypeDeArchivo } from '../../common/mime';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { ExtractionProcessor } from '../extraction/extraction.processor';
import { corregirCamposSchema, normalizarCorrecciones } from './dto/corregir-campos.dto';
import { filtrarFacturasSchema } from './dto/filtrar-facturas.dto';
import { resolverDuplicadoSchema } from './dto/resolver-duplicado.dto';
import { DuplicateMatchingService, type MarcaPendienteConFacturas } from './duplicate-matching.service';
import { FacturaRepository, type ResultadoListado } from './factura.repository';
import { FileStorageService } from './file-storage.service';
import { ImagenWebService, TIPO_TRANSFORMACION_WEB } from './imagen-web.service';

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
    private readonly duplicateMatching: DuplicateMatchingService,
    private readonly imagenWeb: ImagenWebService,
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

  /**
   * Lista filtrable (FR-022): fechaDesde, fechaHasta, comercio, montoMin,
   * montoMax, tipoDocumento, elegibilidad, estado — todos combinables.
   * `sumaTotal` refleja el mismo filtro pero solo documentos en COP (FR-027).
   */
  @Get()
  async listar(@Query() query: unknown): Promise<ResultadoListado> {
    const filtros = filtrarFacturasSchema.parse(query);
    return this.facturaRepository.listar(filtros);
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
   *
   * `?variant=web` devuelve en cambio una rendición JPEG apta para navegador:
   * las fotos de iPhone llegan en HEIC y ningún navegador las renderiza. El
   * original permanece intacto y siempre accesible sin el parámetro
   * (constitution Principio I).
   */
  @Get(':id/image')
  async imagen(
    @Param('id') id: string,
    @Query('variant') variant: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const factura = await this.facturaRepository.obtenerPorId(id);
    if (!factura) {
      throw new NotFoundException(`Factura ${id} no encontrada`);
    }

    if (variant === TIPO_TRANSFORMACION_WEB) {
      const imagen = await this.imagenWeb.obtenerParaNavegador(
        factura.id,
        factura.rutaImagenOriginal,
        factura.derivados,
      );
      res.setHeader('Content-Type', imagen.mimeType);
      res.send(imagen.contenido);
      return;
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

  /**
   * Soft-delete (FR-009/FR-029, constitution Principio I): nunca usa el verbo
   * HTTP DELETE — es una transición de estado, no una operación destructiva
   * sobre el recurso (contracts/api.md). Idempotente: eliminar una factura ya
   * eliminada responde 404 en vez de un segundo efecto.
   */
  @Post(':id/delete')
  async eliminar(@Param('id') id: string): Promise<Factura> {
    const factura = await this.facturaRepository.eliminar(id);
    if (!factura) {
      throw new NotFoundException(`Factura ${id} no encontrada`);
    }
    return factura;
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

  /** Marcas de posible duplicado en `pendiente_confirmacion`, cada una con las dos facturas candidatas (FR-020). */
  @Get('duplicates/pending')
  async duplicadosPendientes(): Promise<MarcaPendienteConFacturas[]> {
    return this.duplicateMatching.obtenerPendientes();
  }

  /** Resuelve una marca pendiente: "duplicado" la confirma, "distinto" la descarta — no bloquea el resto de un lote (FR-020/FR-021). */
  @Post('duplicates/:id/resolve')
  async resolverDuplicado(
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<MarcaPosibleDuplicado> {
    const { resolucion } = resolverDuplicadoSchema.parse(body);
    return this.duplicateMatching.resolver(id, resolucion);
  }
}
