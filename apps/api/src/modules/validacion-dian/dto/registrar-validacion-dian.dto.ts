import { z } from 'zod';

export const registrarValidacionDianSchema = z.object({
  resultado: z.enum(['valido_vigente', 'no_encontrado', 'anulado_reemplazado', 'otro']),
});

export type RegistrarValidacionDianDto = z.infer<typeof registrarValidacionDianSchema>;
