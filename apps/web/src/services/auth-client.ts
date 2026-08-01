import { createAuthClient } from 'better-auth/react';
import { passkeyClient } from '@better-auth/passkey/client';
import { twoFactorClient } from 'better-auth/plugins/two-factor';

/**
 * Sin `baseURL` explícito: el default de Better Auth es `/api/auth`, que ya
 * coincide con el proxy de Vite (`vite.config.ts` quita `/api` antes de
 * reenviar al backend, que monta el handler en `/auth/*splat` — main.ts).
 */
export const authClient = createAuthClient({
  plugins: [
    passkeyClient(),
    twoFactorClient({
      // Sin recargar la página (a diferencia de `twoFactorPage`, que sí la
      // recarga por completo): Login.tsx decide qué mostrar con su propio
      // estado, igual que ya hace con "verifica-tu-correo".
      onTwoFactorRedirect: () => {
        window.dispatchEvent(new CustomEvent('myivo:requiere-totp'));
      },
    }),
  ],
});
