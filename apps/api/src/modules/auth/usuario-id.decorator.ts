import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** SessionUsuarioGuard ya corrió (canActivate) antes de resolver cualquier parámetro de controller — siempre está seteado aquí. */
export const UsuarioId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<Request>();
  return request.usuarioId as string;
});
