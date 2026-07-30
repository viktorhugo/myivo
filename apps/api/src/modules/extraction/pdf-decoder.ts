import { pdfToPng } from 'pdf-to-png-converter';

const CABECERA_PDF = Buffer.from('%PDF-', 'ascii');

/**
 * Detecta un PDF por sus bytes mágicos (research.md § 3, specs/005-captura-pdf-facturas)
 * — nunca por la extensión del nombre de archivo ni el `Content-Type` que reporta el
 * navegador, ninguno de los dos es confiable.
 */
export function esPdf(buffer: Buffer): boolean {
  return buffer.subarray(0, CABECERA_PDF.length).equals(CABECERA_PDF);
}

/**
 * Renderiza la primera página de un PDF a una imagen PNG en memoria (research.md § 1).
 * El resultado se inyecta en el mismo pipeline de imagen que ya existe
 * (`decodificarImagen`, `InvoiceExtractor`, decodificación de QR) sin que ninguno
 * de ellos sepa que el origen fue un PDF (research.md § 2) — solo se procesa la
 * primera página (Assumptions del spec: caso típico, documentado como default).
 */
export async function renderizarPrimeraPagina(buffer: Buffer): Promise<Buffer> {
  const [pagina] = await pdfToPng(buffer, { pagesToProcess: [1] });
  if (!pagina?.content) {
    throw new Error('No se pudo renderizar la primera página del PDF');
  }
  return pagina.content;
}
