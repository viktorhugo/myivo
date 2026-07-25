import { z } from 'zod';

const correccionSchema = z.object({
  campo: z.string().min(1),
  valorCorregido: z.string(),
});

export type Correccion = z.infer<typeof correccionSchema>;

/**
 * `contracts/api.md` describe el body como un arreglo (`{campo, valorCorregido}[]`);
 * `quickstart.md` lo ejercita con un solo objeto. Se aceptan ambas formas y
 * se normalizan a un arreglo — evita forzar al cliente a envolver una sola
 * corrección.
 */
export const corregirCamposSchema = z.union([correccionSchema, z.array(correccionSchema).min(1)]);

export type CorregirCamposDto = z.infer<typeof corregirCamposSchema>;

export function normalizarCorrecciones(dto: CorregirCamposDto): Correccion[] {
  return Array.isArray(dto) ? dto : [dto];
}
