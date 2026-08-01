import { createAuthClient } from 'better-auth/react';

/**
 * Sin `baseURL` explícito: el default de Better Auth es `/api/auth`, que ya
 * coincide con el proxy de Vite (`vite.config.ts` quita `/api` antes de
 * reenviar al backend, que monta el handler en `/auth/*splat` — main.ts).
 */
export const authClient = createAuthClient();
