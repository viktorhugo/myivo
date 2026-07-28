import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  clasificarDocumento,
  evaluarElegibilidad2026,
  UMBRAL_CONFIANZA_BAJA,
  validarExtraccion,
  verificarCuadreMonetario,
  type CufeOrigen,
  type ExtractedInvoiceData,
  type InvoiceExtractor,
} from '@myivo/domain';
import type { Env } from '../../config/env.schema';
import { DuplicateMatchingService } from '../invoices/duplicate-matching.service';
import { FacturaRepository } from '../invoices/factura.repository';
import { FileStorageService } from '../invoices/file-storage.service';
import { decodificarCufeDesdeQr } from './cufe-decoder';
import { VERSION_PROMPT_EXTRACCION } from './extraction-prompt';
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

  private readonly versionModelo: string;
  private readonly identificacionesPropias: readonly string[];

  constructor(
    @Inject(INVOICE_EXTRACTOR) private readonly extractor: InvoiceExtractor,
    private readonly facturaRepository: FacturaRepository,
    private readonly fileStorage: FileStorageService,
    private readonly duplicateMatching: DuplicateMatchingService,
    configService: ConfigService<Env, true>,
  ) {
    const proveedor = configService.get('EXTRACTION_PROVIDER', { infer: true });
    const modelo = configService.get('EXTRACTION_MODEL', { infer: true });
    this.versionModelo = `${proveedor}:${modelo}`;
    this.identificacionesPropias = configService.get('MIS_IDENTIFICACIONES', { infer: true });
  }

  /**
   * Nunca lanza — cualquier fallo (red, validación, lo que sea) termina en
   * `fallida` (FR-013); el llamador no necesita su propio try/catch.
   *
   * La transición a `procesando` es condicional: si el llamador ya la hizo
   * (p. ej. `POST /invoices/:id/reprocess`, que transiciona antes de
   * responder para que el frontend vea el estado intermedio en vez de solo
   * el resultado final), repetirla lanzaría por ser `procesando -> procesando`,
   * una transición no definida en la máquina de estados.
   */
  async procesar(facturaId: string): Promise<void> {
    const actual = await this.facturaRepository.obtenerPorId(facturaId);
    if (actual && actual.estado !== 'procesando') {
      await this.facturaRepository.actualizarEstado(facturaId, 'procesando');
    }

    try {
      const factura = actual ?? (await this.facturaRepository.obtenerPorId(facturaId));
      if (!factura) {
        throw new Error(`Factura ${facturaId} no encontrada`);
      }

      const imagen = await this.fileStorage.leer(factura.rutaImagenOriginal);

      const [datos, cufePorQr] = await Promise.all([
        this.extraerYValidar(imagen),
        decodificarCufeDesdeQr(imagen),
      ]);

      // FR-028/FR-010 (specs/002-rediseno-visual-web US3): una foto con más de
      // un documento de compra queda marcada, no mezclada — ningún campo
      // extraído se persiste, el usuario recaptura cada documento por separado.
      if (datos.múltiplesDocumentos) {
        await this.facturaRepository.actualizarEstado(facturaId, 'varias_facturas');
        return;
      }

      const { cufe, cufeOrigen } = this.resolverCufe(cufePorQr?.cufe ?? null, datos.cufeImpreso);

      // Clasificación tributaria (US3, constitution Principio IV): reglas
      // determinísticas del dominio, nunca una opinión del LLM.
      const tipoDocumento = clasificarDocumento({
        cufe,
        comercioNombre: datos.comercioNombre,
        totalCentavos: datos.totalCentavos,
        items: datos.items,
      });
      const elegibilidad = evaluarElegibilidad2026(
        { tipoDocumento, adquirienteIdentificacion: datos.adquirienteIdentificacion, medioPago: datos.medioPago },
        this.identificacionesPropias,
      );

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
          tipoDocumento,
          elegibilidadTributaria: elegibilidad.elegible,
          elegibilidadMotivo: elegibilidad.motivo,
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
        versionModelo: this.versionModelo,
      });

      const necesitaRevision = this.necesitaRevision(datos, cufeOrigen);
      await this.facturaRepository.actualizarEstado(
        facturaId,
        necesitaRevision ? 'necesita_revisión' : 'extraída',
      );

      // Ortogonal a Factura.estado (data-model.md, US5): un fallo aquí nunca
      // debe tumbar una extracción que sí funcionó (FR-021 — no bloquea el
      // resto de un lote), por eso tiene su propio try/catch aparte.
      try {
        await this.duplicateMatching.detectarYRegistrar(facturaId);
      } catch (errorDuplicados) {
        this.logger.error(
          `Detección de duplicados falló para factura ${facturaId}`,
          errorDuplicados instanceof Error ? errorDuplicados.stack : String(errorDuplicados),
        );
      }
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
