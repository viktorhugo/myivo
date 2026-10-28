import { z } from 'zod';

/** FR-002: confirmación deliberada — repetir el correo es más difícil de disparar por accidente que un booleano `{confirmar: true}`. */
export const eliminarCuentaSchema = z.object({
  correoConfirmacion: z.string().email('Correo de confirmación inválido'),
});

export type EliminarCuentaDto = z.infer<typeof eliminarCuentaSchema>;
