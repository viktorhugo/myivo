import sharp from 'sharp';
import decodeHeic from 'heic-decode';

/**
 * Punto de entrada único para decodificar cualquier imagen soportada
 * (jpg/png/webp/heic) a un pipeline de sharp listo para encadenar `.jpeg()`,
 * `.raw()`, etc. — usado tanto por los adaptadores de extracción como por el
 * decodificador de CUFE (`cufe-decoder.ts`).
 *
 * sharp (vía su libheif nativo — 1.23.1 al momento de escribir esto) rechaza
 * fotos HEIC reales de iPhone con "Security limit exceeded: Number of
 * references in iref box": las cámaras modernas incrustan varias imágenes
 * auxiliares (gain map HDR, mapa de profundidad, miniaturas) y superan el
 * límite conservador que libheif trae por defecto (16 referencias).
 * Verificado con una foto real de un tiquete D1 (42 referencias) que sharp
 * rechazaba de forma consistente. `heic-decode` usa una versión más antigua
 * de la misma librería (vía WASM) que no aplica ese límite — se usa
 * únicamente como respaldo cuando sharp falla específicamente por HEIF; el
 * resto de formatos sigue por la vía rápida nativa de sharp.
 */
export async function decodificarImagen(buffer: Buffer): Promise<sharp.Sharp> {
  try {
    await sharp(buffer).metadata();
    return sharp(buffer);
  } catch (error) {
    const esErrorHeif = error instanceof Error && /heif/i.test(error.message);
    if (!esErrorHeif) {
      throw error;
    }
    const { width, height, data } = await decodeHeic({ buffer });
    return sharp(Buffer.from(data), { raw: { width, height, channels: 4 } });
  }
}
