import { z } from 'zod';

export const actualizarIdentificacionesSchema = z.object({
  identificaciones: z.array(z.string().min(1)).min(1, 'Configura al menos una identificación tributaria'),
});

export type ActualizarIdentificacionesDto = z.infer<typeof actualizarIdentificacionesSchema>;
