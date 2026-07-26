import jsQR from 'jsqr';
import type { CufeOrigen } from '@myivo/domain';
import { decodificarImagen } from './image-decoder';

export interface CufeDecodificado {
  cufe: string;
  origen: Extract<CufeOrigen, 'qr'>;
}

/**
 * Decodifica el CUFE/CUDE desde el código QR de una factura electrónica.
 * Determinístico y ejecutado antes/independiente de cualquier llamada a un
 * LLM — nunca vía OCR o modelo de lenguaje (constitution Principio III,
 * research.md § 4). `null` cubre tanto "no hay QR" (tiquete POS — flujo
 * normal) como "QR ilegible"; en ambos casos el llamador decide si intenta
 * el respaldo de FR-008.
 */
export async function decodificarCufeDesdeQr(imagen: Buffer): Promise<CufeDecodificado | null> {
  let pixeles: { data: Buffer; info: { width: number; height: number } };
  try {
    pixeles = await (await decodificarImagen(imagen)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  } catch {
    return null;
  }

  const resultado = jsQR(
    new Uint8ClampedArray(pixeles.data),
    pixeles.info.width,
    pixeles.info.height,
  );
  if (!resultado) {
    return null;
  }

  return { cufe: extraerCufeDeTexto(resultado.data), origen: 'qr' };
}

/**
 * El QR de facturación electrónica colombiana suele codificar una URL del
 * catálogo DIAN con el CUFE como query param (`documentkey` o `cufe`), pero
 * el formato exacto varía entre proveedores tecnológicos de facturación. Si
 * el contenido no es una URL con ese parámetro, se asume que el texto
 * completo del QR ya es el CUFE.
 */
function extraerCufeDeTexto(texto: string): string {
  try {
    const url = new URL(texto);
    const porQuery = url.searchParams.get('documentkey') ?? url.searchParams.get('cufe');
    if (porQuery) {
      return porQuery;
    }
  } catch {
    // No es una URL válida — se trata el texto completo como el CUFE.
  }
  return texto;
}
