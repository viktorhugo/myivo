import { createAuthClient } from 'better-auth/react';
import { passkeyClient } from '@better-auth/passkey/client';
import { twoFactorClient } from 'better-auth/plugins/two-factor';
import { Capacitor } from '@capacitor/core';
import { API_BASE_URL } from './invoices';

/**
 * En nativo (Capacitor), `window.location.origin` es `capacitor://localhost`
 * — Better Auth exige http(s) explícito y tira `BetterAuthError: Invalid
 * base URL` si lo deja resolver solo (specs/009, verificado contra el
 * código fuente instalado de better-auth@1.6.25, utils/url.mjs). Por eso acá
 * SÍ hace falta un `baseURL` absoluto, construido sobre el mismo
 * `API_BASE_URL` que ya usa el resto de los servicios (debe ser absoluto —
 * `VITE_API_BASE_URL` — al compilar para nativo, no alcanza con el default
 * relativo `/api`).
 *
 * En web se deja `undefined` a propósito: así Better Auth sigue resolviendo
 * contra el origin real de la página, y su default `/api/auth` coincide con
 * el proxy de Vite/Caddy (`vite.config.ts`/`Caddyfile` quitan `/api` antes
 * de reenviar al backend, que monta el handler en `/auth/*splat` — main.ts).
 */
export const authClient = createAuthClient({
  baseURL: Capacitor.isNativePlatform() ? `${API_BASE_URL}/auth` : undefined,
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
