import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

/** Guideline 4.2 de Apple (research.md § Decisión 2, specs/009): cruza el puente nativo de
 * Capacitor en vez de depender solo de `<input capture>`, que WKWebView resuelve igual que
 * cualquier navegador y no cuenta como capacidad nativa real. */
export function esPlataformaNativa(): boolean {
  return Capacitor.isNativePlatform();
}

/** Devuelve `null` en web — ahí el `<input type="file" capture>` existente sigue a cargo. */
export async function tomarFotoNativa(): Promise<File | null> {
  if (!esPlataformaNativa()) return null;

  let foto;
  try {
    foto = await Camera.getPhoto({
      quality: 90,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
    });
  } catch (err) {
    // El usuario cancela la cámara con cierta frecuencia — no es un error a mostrar.
    if (err instanceof Error && /cancel/i.test(err.message)) return null;
    throw err;
  }
  if (!foto.webPath) return null;

  const respuesta = await fetch(foto.webPath);
  const blob = await respuesta.blob();
  const extension = foto.format ?? 'jpeg';
  return new File([blob], `factura-${Date.now()}.${extension}`, {
    type: blob.type || `image/${extension}`,
  });
}
