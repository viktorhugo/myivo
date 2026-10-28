import { Global, Module } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';

// @Global(): CuentaEliminacionService (auth) y PurgaCuentasService (purga-cuentas)
// la inyectan sin importar este módulo explícitamente — mismo patrón que
// PrismaModule/AuthModule.
@Global()
@Module({
  providers: [NotificacionesService],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
