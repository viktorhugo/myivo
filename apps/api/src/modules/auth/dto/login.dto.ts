import { z } from 'zod';

export const loginSchema = z.object({
  usuario: z.string().min(1),
  contraseña: z.string().min(1),
});

export type LoginDto = z.infer<typeof loginSchema>;
