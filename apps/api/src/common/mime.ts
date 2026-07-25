import { extname } from 'node:path';

const MIME_POR_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.heic': 'image/heic',
  '.webp': 'image/webp',
};

export function mimeTypeDeArchivo(ruta: string): string {
  return MIME_POR_EXTENSION[extname(ruta).toLowerCase()] ?? 'application/octet-stream';
}
