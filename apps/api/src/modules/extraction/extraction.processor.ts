import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  UMBRAL_CONFIANZA_BAJA,
  validarExtraccion,
  verificarCuadreMonetario,
  type CufeOrigen,
  type ExtractedInvoiceData,
  type InvoiceExtractor,
} from '@myivo/domain';
import { FacturaRepository } from '../invoices/factura.repository';
import { FileStorageService } from '../invoices/file-storage.service';
import { decodificarCufeDesdeQr } from './cufe-decoder';
import { MODELO_EXTRACCION, VERSION_PROMPT_EXTRACCION } from './claude-invoice-extractor.adapter';
import { INVOICE_EXTRACTOR } from './invoice-extractor.token';

/**
 * Orquestador de extracción (T031): toma una Factura en `recibida` (o
 * `fallida`, en un reintento — ambas transicionan a `procesando`), invoca el
 * extractor + el decodificador de CUFE, verifica el cuadre monetario, y
 * transiciona el estado según el resultado.
 */
@Injectable()
export class ExtractionProcessor {
  private readonly logger = new Logger(ExtractionProcessor.name);

  constructor(
    @Inject(INVOICE_EXTRACTOR) private readonly extractor: InvoiceExtractor,
    private readonly facturaRepository: FacturaRepository,
    private readonly fileStorage: FileStorageService,
  ) {}

  /**
   * Nunca lanza — cualquier fallo (red, validación, lo que sea) termina en
   * `fallida` (FR-013); el llamador no necesita su propio try/catch.
   */
  async procesar(facturaId: string): Promise<void> {
    await this.facturaRepository.actualizarEstado(facturaId, 'procesando');

    try {
      const factura = await this.facturaRepository.obtenerPorId(facturaId);
      if (!factura) {
        throw new Error(`Factura ${facturaId} no encontrada`);
      }

      const imagen = await this.fileStorage.leer(factura.rutaImagenOriginal);

      const [datos, cufePorQr] = await Promise.all([
        this.extraerYValidar(imagen),
        decodificarCufeDesdeQr(imagen),
      ]);

      const { cufe, cufeOrigen } = this.resolverCufe(cufePorQr?.cufe ?? null, datos.cufeImpreso);

      await this.facturaRepository.guardarResultadoExtraccion(
        facturaId,
        {
          comercioNombre: datos.comercioNombre,
          comercioNIT: datos.comercioNIT,
          fechaHoraCompra: datos.fechaHoraCompra ? new Date(datos.fechaHoraCompra) : null,
          moneda: datos.moneda,
          subtotalCentavos: datos.subtotalCentavos,
          ivaPorTarifa: datos.ivaPorTarifa,
          impuestoConsumoCentavos: datos.impuestoConsumoCentavos,
          propinaCentavos: datos.propinaCentavos,
          totalCentavos: datos.totalCentavos,
          medioPago: datos.medioPago,
          adquirienteNombre: datos.adquirienteNombre,
          adquirienteIdentificacion: datos.adquirienteIdentificacion,
          cufe,
          cufeOrigen,
          confianzaCampos: datos.confianzaCampos,
        },
        datos.items.map((item) => ({
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          valorUnitarioCentavos: item.valorUnitarioCentavos,
          valorTotalCentavos: item.valorTotalCentavos,
          nivelConfianza: item.confianza,
        })),
      );

      await this.facturaRepository.registrarExtraccionCruda(facturaId, {
        jsonCrudo: datos,
        versionPrompt: VERSION_PROMPT_EXTRACCION,
        versionModelo: MODELO_EXTRACCION,
      });

      const necesitaRevision = this.necesitaRevision(datos, cufeOrigen);
      await this.facturaRepository.actualizarEstado(
        facturaId,
        necesitaRevision ? 'necesita_revisión' : 'extraída',
      );
    } catch (error) {
      this.logger.error(
        `Extracción fallida para factura ${facturaId}`,
        error instanceof Error ? error.stack : String(error),
      );
      await this.facturaRepository.actualizarEstado(facturaId, 'fallida');
    }
  }

  private async extraerYValidar(imagen: Buffer): Promise<ExtractedInvoiceData> {
    const crudo = await this.extractor.extract(imagen);
    // Segunda capa de validación (constitution Principio III): el dominio no
    // asume que un adaptador concreto respetó el contrato del puerto, más
    // allá de la validación de forma que ya haya hecho la API del proveedor.
    return validarExtraccion(crudo);
  }

  private resolverCufe(
    cufePorQr: string | null,
    cufeImpreso: string | null,
  ): { cufe: string | null; cufeOrigen: CufeOrigen | null } {
    if (cufePorQr) {
      return { cufe: cufePorQr, cufeOrigen: 'qr' };
    }
    if (cufeImpreso) {
      return { cufe: cufeImpreso, cufeOrigen: 'ocr_respaldo' };
    }
    return { cufe: null, cufeOrigen: null };
  }

  private necesitaRevision(datos: ExtractedInvoiceData, cufeOrigen: CufeOrigen | null): boolean {
    const cuadre = verificarCuadreMonetario(datos);
    if (!cuadre.cuadra) {
      return true;
    }
    if (cufeOrigen === 'ocr_respaldo') {
      // FR-008: el CUFE de respaldo (no leído de QR) siempre implica confianza reducida.
      return true;
    }
    const confianzas = [
      ...Object.values(datos.confianzaCampos),
      ...datos.items.map((item) => item.confianza),
    ];
    return confianzas.some((valor) => valor < UMBRAL_CONFIANZA_BAJA);
  }
}
