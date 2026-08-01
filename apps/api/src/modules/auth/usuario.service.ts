import { Injectable } from '@nestjs/common';
import { InjectTransaction } from '@nestjs-cls/transactional';
import type { PrismaClient } from '@prisma/client';

@Injectable()
export class UsuarioService {
  constructor(@InjectTransaction() private readonly prisma: PrismaClient) {}

  /**
   * Reemplaza MIS_IDENTIFICACIONES (FR-007): propia de cada cuenta, se lee
   * en cada evaluación de elegibilidad — nunca cacheada en memoria, para que
   * un cambio vía PUT /cuenta/identificaciones aplique de inmediato a la
   * siguiente factura (US2 Acceptance Scenario 2), sin reiniciar nada.
   */
  async identificacionesDe(usuarioId: string): Promise<readonly string[]> {
    const usuario = await this.prisma.user.findUniqueOrThrow({
      where: { id: usuarioId },
      select: { identificacionesTributarias: true },
    });
    return usuario.identificacionesTributarias;
  }
}
