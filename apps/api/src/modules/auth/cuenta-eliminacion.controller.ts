import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { eliminarCuentaSchema } from './dto/eliminar-cuenta.dto';
import { SessionUsuarioGuard } from './guards/session-usuario.guard';
import { UsuarioId } from './usuario-id.decorator';
import { CuentaEliminacionService } from './cuenta-eliminacion.service';

/** specs/008-borrado-cuenta — contrato en contracts/cuenta-eliminacion.md. */
@Controller('cuenta/eliminacion')
@UseGuards(SessionUsuarioGuard)
export class CuentaEliminacionController {
  constructor(private readonly cuentaEliminacionService: CuentaEliminacionService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async solicitar(
    @Body() body: unknown,
    @UsuarioId() usuarioId: string,
  ): Promise<{ eliminacionProgramadaPara: Date }> {
    const { correoConfirmacion } = eliminarCuentaSchema.parse(body);
    return this.cuentaEliminacionService.solicitar(usuarioId, correoConfirmacion);
  }

  @Get()
  async obtenerEstado(
    @UsuarioId() usuarioId: string,
  ): Promise<{ eliminacionProgramadaPara: Date | null; eliminacionSolicitadaEn: Date | null }> {
    return this.cuentaEliminacionService.obtenerEstado(usuarioId);
  }

  @Post('cancelar')
  @HttpCode(HttpStatus.OK)
  async cancelar(@UsuarioId() usuarioId: string): Promise<{ eliminacionProgramadaPara: null }> {
    return this.cuentaEliminacionService.cancelar(usuarioId);
  }
}
