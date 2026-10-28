import { asuntoCorreoEventoSeguridad } from './auth';

describe('asuntoCorreoEventoSeguridad (política de notificaciones, Fase 0 ítem 4)', () => {
  it.each([
    ['/two-factor/enable', 'Verificación en dos pasos activada — MyIvo'],
    ['/two-factor/disable', 'Verificación en dos pasos desactivada — MyIvo'],
    ['/change-password', 'Tu contraseña fue cambiada — MyIvo'],
    ['/passkey/verify-registration', 'Se agregó un passkey a tu cuenta — MyIvo'],
    ['/passkey/delete-passkey', 'Se eliminó un passkey de tu cuenta — MyIvo'],
  ])('mapea %s a su asunto de correo', (ruta, asuntoEsperado) => {
    expect(asuntoCorreoEventoSeguridad(ruta)).toBe(asuntoEsperado);
  });

  it.each([
    '/passkey/generate-register-options',
    '/passkey/list-user-passkeys',
    '/sign-in/email',
    '/two-factor/verify-totp',
    '/cuenta/eliminacion',
  ])('no manda correo para %s (no es un evento de la política)', (ruta) => {
    expect(asuntoCorreoEventoSeguridad(ruta)).toBeNull();
  });
});
