import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectTransaction } from '@nestjs-cls/transactional';
import type { PrismaClient } from '@prisma/client';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

/** FR-004: ventana de reversión — constitution Principio I v2.1.0, única excepción al soft-delete puro. */
const VENTANA_DE_GRACIA_EN_DIAS = 30;

/**
 * specs/008-borrado-cuenta. No usa el borrado nativo de Better Auth
 * (`/delete-user`, D1 en research.md): es inmediato y duro, sin ventana de
 * gracia, y fallaría hoy contra la FK de `Factura.usuarioId` (sin
 * `onDelete: Cascade`, deliberado). Marca el estado y revoca sesiones — el
 * borrado físico real lo hace el comando de purga (purgar-cuentas-eliminadas.ts).
 *
 * `@InjectTransaction()`: cada request autenticado ya corre dentro de la
 * transacción que abre RlsTransactionInterceptor (rls-transaction.interceptor.ts)
 * — ambas escrituras de `solicitar` quedan atómicas sin abrir una transacción propia.
 */
@Injectable()
export class CuentaEliminacionService {
  constructor(
    @InjectTransaction() private readonly prisma: PrismaClient,
    private readonly notificaciones: NotificacionesService,
  ) {}

  /** FR-001 a FR-003, FR-011 (D1-D3 en research.md). */
  async solicitar(usuarioId: string, correoConfirmacion: string): Promise<{ eliminacionProgramadaPara: Date }> {
    const usuario = await this.prisma.user.findUniqueOrThrow({
      where: { id: usuarioId },
      select: { email: true, eliminacionProgramadaPara: true },
    });

    if (usuario.eliminacionProgramadaPara) {
      // FR-011: no reinicia el plazo ni crea una segunda purga paralela.
      throw new ConflictException({
        message: 'La cuenta ya tiene una eliminación programada',
        eliminacionProgramadaPara: usuario.eliminacionProgramadaPara,
      });
    }

    if (usuario.email !== correoConfirmacion) {
      throw new BadRequestException('El correo de confirmación no coincide con el de la cuenta');
    }

    const ahora = new Date();
    const eliminacionProgramadaPara = new Date(ahora.getTime() + VENTANA_DE_GRACIA_EN_DIAS * 24 * 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: usuarioId },
      data: { eliminacionSolicitadaEn: ahora, eliminacionProgramadaPara },
    });
    // FR-003: cierra toda sesión abierta en cualquier dispositivo, incluida
    // la que hizo esta misma request — queda sin acceso al recibir la respuesta.
    await this.prisma.session.deleteMany({ where: { userId: usuarioId } });

    // Confirmación escrita de una acción irreversible por diseño (constitution
    // Principio I v2.1.0) — si alguien más programó el borrado, esto es la
    // única señal que el titular real tiene para enterarse y revertirlo.
    await this.notificaciones.enviarCorreo(
      usuario.email,
      'Tu cuenta de Cufeo será eliminada — Cufeo',
      `<p>Programaste la eliminación de tu cuenta de Cufeo.</p><p>Se eliminará de forma irreversible el <strong>${eliminacionProgramadaPara.toLocaleDateString('es-CO')}</strong> si no la cancelás antes volviendo a iniciar sesión.</p><p>Si no fuiste vos, iniciá sesión de inmediato para cancelarla.</p>`,
    );

    return { eliminacionProgramadaPara };
  }

  /** FR-005/US2 (D2/D3 en research.md) — único estado que una cuenta con eliminación programada puede consultar. */
  async obtenerEstado(
    usuarioId: string,
  ): Promise<{ eliminacionProgramadaPara: Date | null; eliminacionSolicitadaEn: Date | null }> {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: usuarioId },
      select: { eliminacionProgramadaPara: true, eliminacionSolicitadaEn: true },
    });
  }

  /**
   * FR-005/US2 — revierte sin pérdida de datos. `eliminacionSolicitadaEn` NO
   * se limpia (D7 en research.md): queda como historial auditable aunque se
   * cancele. Login-dentro-de-la-ventana-cancela es autoservicio (D3) — no
   * hay infraestructura de soporte en este proyecto.
   */
  async cancelar(usuarioId: string): Promise<{ eliminacionProgramadaPara: null }> {
    const usuario = await this.prisma.user.findUniqueOrThrow({
      where: { id: usuarioId },
      select: { email: true, eliminacionProgramadaPara: true },
    });

    if (!usuario.eliminacionProgramadaPara) {
      throw new ConflictException('La cuenta no tiene ninguna eliminación programada para cancelar');
    }

    await this.prisma.user.update({ where: { id: usuarioId }, data: { eliminacionProgramadaPara: null } });
    await this.notificaciones.enviarCorreo(
      usuario.email,
      'Cancelaste la eliminación de tu cuenta — Cufeo',
      '<p>Tu cuenta de Cufeo ya no tiene ninguna eliminación programada — seguís con acceso normal.</p>',
    );
    return { eliminacionProgramadaPara: null };
  }
}
