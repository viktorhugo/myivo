import { z } from 'zod';

export const resolverDuplicadoSchema = z.object({
  resolucion: z.enum(['duplicado', 'distinto']),
});

export type ResolverDuplicadoDto = z.infer<typeof resolverDuplicadoSchema>;
