import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { actualizarIdentificacionesSchema } from './dto/actualizar-identificaciones.dto';
import { SessionUsuarioGuard } from './guards/session-usuario.guard';
import { UsuarioId } from './usuario-id.decorator';
import { UsuarioService } from './usuario.service';

/** US2 — contracts/api.md § Identificaciones tributarias propias, FR-007. */
@Controller('cuenta/identificaciones')
@UseGuards(SessionUsuarioGuard)
export class CuentaController {
  constructor(private readonly usuarioService: UsuarioService) {}

  @Get()
  async obtener(@UsuarioId() usuarioId: string): Promise<{ identificaciones: readonly string[] }> {
    const identificaciones = await this.usuarioService.identificacionesDe(usuarioId);
    return { identificaciones };
  }

  /** Reemplaza la lista completa (mismo criterio que la variable MIS_IDENTIFICACIONES que reemplaza) — efecto inmediato en la próxima evaluación de elegibilidad, sin reiniciar nada. */
  @Put()
  async actualizar(
    @Body() body: unknown,
    @UsuarioId() usuarioId: string,
  ): Promise<{ identificaciones: readonly string[] }> {
    const { identificaciones } = actualizarIdentificacionesSchema.parse(body);
    const actualizadas = await this.usuarioService.actualizarIdentificaciones(usuarioId, identificaciones);
    return { identificaciones: actualizadas };
  }
}
