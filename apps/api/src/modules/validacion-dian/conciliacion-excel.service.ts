import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';

const PRIMER_PUNTO_CODIGO_DIACRITICO = 0x0300;
const ULTIMO_PUNTO_CODIGO_DIACRITICO = 0x036f;

/** Mismo criterio de legibilidad que `normalizarNombreComercio` (duplicate-matching.service.ts): por código de carácter, no por rango Unicode literal en una regex. */
function normalizarCabecera(texto: string): string {
  let sinDiacriticos = '';
  for (const caracter of texto.normalize('NFD')) {
    const codigo = caracter.codePointAt(0) ?? 0;
    if (codigo < PRIMER_PUNTO_CODIGO_DIACRITICO || codigo > ULTIMO_PUNTO_CODIGO_DIACRITICO) {
      sinDiacriticos += caracter;
    }
  }
  return sinDiacriticos.toLowerCase().trim();
}

/**
 * Parsea el Excel de conciliación tal cual lo exporta el portal de la DIAN
 * (research.md § 3, specs/003-validacion-dian).
 *
 * ⚠️ El esquema exacto de columnas NO se pudo confirmar sin acceso
 * autenticado al portal transaccional de un contribuyente real — por eso
 * busca, entre las cabeceras de la primera fila, cualquier columna cuyo
 * nombre normalizado contenga "cufe" o "cude", en vez de asumir una posición
 * fija. Esto sigue sin validarse contra un archivo real de la DIAN: si la
 * conciliación falla en producción con un archivo que a simple vista se ve
 * correcto, este es el primer lugar a revisar.
 */
@Injectable()
export class ConciliacionExcelService {
  async extraerCufes(buffer: Buffer): Promise<string[]> {
    const workbook = new ExcelJS.Workbook();
    try {
      // exceljs trae su propia copia de @types/node (Buffer no genérico),
      // distinta de la del monorepo — mismo Buffer real de Node en runtime.
      await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    } catch {
      throw new BadRequestException('El archivo no es un Excel (.xlsx) válido');
    }

    const hoja = workbook.worksheets[0];
    if (!hoja) {
      throw new BadRequestException('El archivo no contiene ninguna hoja');
    }

    let columnaCufe: number | null = null;
    hoja.getRow(1).eachCell((celda, numeroColumna) => {
      const normalizado = normalizarCabecera(celda.text);
      if (columnaCufe === null && (normalizado.includes('cufe') || normalizado.includes('cude'))) {
        columnaCufe = numeroColumna;
      }
    });

    if (columnaCufe === null) {
      throw new BadRequestException(
        'No se encontró ninguna columna de CUFE/CUDE en el archivo — revisa que sea el reporte exportado del portal de la DIAN',
      );
    }
    const indiceColumnaCufe: number = columnaCufe;

    const cufes: string[] = [];
    hoja.eachRow((fila, numeroFila) => {
      if (numeroFila === 1) return; // cabecera
      const valor = fila.getCell(indiceColumnaCufe).text.trim();
      if (valor) {
        cufes.push(valor);
      }
    });

    return cufes;
  }
}
