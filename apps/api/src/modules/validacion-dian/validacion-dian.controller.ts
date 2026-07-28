import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { ValidacionDian } from '@myivo/domain';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { registrarValidacionDianSchema } from './dto/registrar-validacion-dian.dto';
import { ValidacionDianRepository } from './validacion-dian.repository';

@Controller('invoices/:facturaId/validaciones-dian')
@UseGuards(SessionAuthGuard)
export class ValidacionDianController {
  constructor(private readonly validacionDianRepository: ValidacionDianRepository) {}

  /** Registra el resultado que el usuario reportó tras consultar el CUFE en la DIAN (FR-003/FR-004). */
  @Post()
  async registrar(
    @Param('facturaId') facturaId: string,
    @Body() body: unknown,
  ): Promise<ValidacionDian> {
    const { resultado } = registrarValidacionDianSchema.parse(body);
    return this.validacionDianRepository.crear(facturaId, 'manual', resultado);
  }

  /** Historial completo de validaciones de una factura (FR-010), más reciente primero. */
  @Get()
  async listar(@Param('facturaId') facturaId: string): Promise<ValidacionDian[]> {
    return this.validacionDianRepository.listarPorFactura(facturaId);
  }
}
