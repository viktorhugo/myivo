import { BadRequestException, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { conciliarCufes } from '@myivo/domain';
import { SessionUsuarioGuard } from '../auth/guards/session-usuario.guard';
import { UsuarioId } from '../auth/usuario-id.decorator';
import { FacturaRepository } from '../invoices/factura.repository';
import { ConciliacionExcelService } from './conciliacion-excel.service';
import { ValidacionDianRepository } from './validacion-dian.repository';

export interface ResumenConciliacionDian {
  facturasConciliadas: number;
  cufesSinCoincidencia: number;
}

/**
 * Ruta hermana de `invoices/:facturaId/validaciones-dian`, no anidada bajo
 * un id — controller separado en el mismo módulo (contracts/api.md).
 */
@Controller('invoices/dian-conciliacion')
@UseGuards(SessionUsuarioGuard)
export class ConciliacionDianController {
  constructor(
    private readonly conciliacionExcel: ConciliacionExcelService,
    private readonly facturaRepository: FacturaRepository,
    private readonly validacionDianRepository: ValidacionDianRepository,
  ) {}

  /** Conciliación en lote (US2, FR-007/FR-008/FR-009) — un único archivo `.xlsx`. */
  @Post()
  @UseInterceptors(FileInterceptor('archivo'))
  async conciliar(
    @UsuarioId() usuarioId: string,
    @UploadedFile() archivo?: Express.Multer.File,
  ): Promise<ResumenConciliacionDian> {
    if (!archivo) {
      throw new BadRequestException('Debes adjuntar un archivo');
    }

    const cufesDelDocumento = await this.conciliacionExcel.extraerCufes(archivo.buffer);
    const facturasCandidatas = await this.facturaRepository.listarConCufe(usuarioId);
    const resultado = conciliarCufes(cufesDelDocumento, facturasCandidatas);

    // Estar en el listado oficial de documentos recibidos de la DIAN implica
    // que el documento fue recibido y es válido (data-model.md § Regla de
    // dominio: conciliación en lote).
    for (const facturaId of resultado.facturaIdsConciliadas) {
      await this.validacionDianRepository.crear(facturaId, usuarioId, 'conciliacion', 'valido_vigente');
    }

    return {
      facturasConciliadas: resultado.facturaIdsConciliadas.length,
      cufesSinCoincidencia: resultado.cufesSinCoincidencia.length,
    };
  }
}
