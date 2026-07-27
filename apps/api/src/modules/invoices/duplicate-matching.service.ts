import { Injectable, NotFoundException } from '@nestjs/common';
import { esDuplicadoExactoPorCufe, type Factura, type MarcaPosibleDuplicado } from '@myivo/domain';
import { PrismaService } from '../../prisma/prisma.service';
import { aDominio } from './factura.repository';

/** Similitud mínima (0-1) de `similarity()` de pg_trgm para considerar dos nombres de comercio "el mismo" (research.md § 6). */
const UMBRAL_SIMILITUD_COMERCIO = 0.4;

const PRIMER_PUNTO_CODIGO_DIACRITICO = 0x0300;
const ULTIMO_PUNTO_CODIGO_DIACRITICO = 0x036f;

/**
 * Quita las marcas diacríticas combinantes (tildes, diéresis, etc.) que
 * `normalize('NFD')` separa de su letra base — bloque Unicode "Combining
 * Diacritical Marks", U+0300-U+036F. Se filtra por código de carácter en vez
 * de con un rango Unicode literal dentro de una regex, para que quede
 * legible/verificable como números en el código fuente.
 */
function quitarDiacriticos(textoDescompuesto: string): string {
  let resultado = '';
  for (const caracter of textoDescompuesto) {
    const codigo = caracter.codePointAt(0) ?? 0;
    if (codigo < PRIMER_PUNTO_CODIGO_DIACRITICO || codigo > ULTIMO_PUNTO_CODIGO_DIACRITICO) {
      resultado += caracter;
    }
  }
  return resultado;
}

/** minúsculas, sin tildes, sin puntuación (research.md § 6) — insumo de la coincidencia difusa por `pg_trgm`. */
export function normalizarNombreComercio(nombre: string): string {
  return quitarDiacriticos(nombre.normalize('NFD'))
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface CandidatoFuzzy {
  id: string;
}

export interface MarcaPendienteConFacturas extends MarcaPosibleDuplicado {
  facturaOriginal: Factura;
  facturaCandidata: Factura;
}

@Injectable()
export class DuplicateMatchingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Detecta duplicados para una factura recién extraída y, si encuentra uno,
   * registra la marca (idempotente: no duplica una marca ya existente entre
   * el mismo par). FR-019 (CUFE exacto, automático) tiene prioridad sobre
   * FR-020 (difuso, sin CUFE) — un documento con CUFE nunca pasa por el
   * mecanismo difuso, evita falsos positivos entre dos facturas electrónicas
   * distintas que coincidan en comercio/fecha/total por casualidad.
   */
  async detectarYRegistrar(facturaId: string): Promise<void> {
    const factura = await this.prisma.factura.findUnique({ where: { id: facturaId } });
    if (!factura) {
      return;
    }

    if (factura.cufe) {
      const otraConMismoCufe = await this.prisma.factura.findFirst({
        where: { id: { not: facturaId }, cufe: factura.cufe },
        orderBy: { creadaEn: 'asc' },
      });
      if (otraConMismoCufe && esDuplicadoExactoPorCufe(factura.cufe, otraConMismoCufe.cufe)) {
        await this.registrarSiNoExiste(otraConMismoCufe.id, facturaId, 'cufe_exacto', 'duplicado_confirmado');
      }
      return;
    }

    if (
      !factura.comercioNombreNormalizado ||
      factura.fechaHoraCompra === null ||
      factura.totalCentavos === null
    ) {
      return;
    }

    const candidatos = await this.prisma.$queryRaw<CandidatoFuzzy[]>`
      SELECT id FROM facturas
      WHERE id != ${facturaId}
        AND cufe IS NULL
        AND "fechaHoraCompra"::date = ${factura.fechaHoraCompra}::date
        AND "totalCentavos" = ${factura.totalCentavos}
        AND "comercioNombreNormalizado" IS NOT NULL
        AND similarity("comercioNombreNormalizado", ${factura.comercioNombreNormalizado}) > ${UMBRAL_SIMILITUD_COMERCIO}
      ORDER BY similarity("comercioNombreNormalizado", ${factura.comercioNombreNormalizado}) DESC
      LIMIT 1
    `;

    const candidato = candidatos[0];
    if (candidato) {
      await this.registrarSiNoExiste(
        candidato.id,
        facturaId,
        'comercio_fecha_total_similar',
        'pendiente_confirmacion',
      );
    }
  }

  private async registrarSiNoExiste(
    facturaOriginalId: string,
    facturaCandidataId: string,
    metodoDeteccion: 'cufe_exacto' | 'comercio_fecha_total_similar',
    estado: 'duplicado_confirmado' | 'pendiente_confirmacion',
  ): Promise<void> {
    const yaExiste = await this.prisma.marcaPosibleDuplicado.findFirst({
      where: {
        OR: [
          { facturaOriginalId, facturaCandidataId },
          { facturaOriginalId: facturaCandidataId, facturaCandidataId: facturaOriginalId },
        ],
      },
    });
    if (yaExiste) {
      return;
    }

    await this.prisma.marcaPosibleDuplicado.create({
      data: { facturaOriginalId, facturaCandidataId, metodoDeteccion, estado },
    });
  }

  /** Cada marca pendiente, con las dos facturas candidatas completas (contracts/api.md). */
  async obtenerPendientes(): Promise<MarcaPendienteConFacturas[]> {
    const filas = await this.prisma.marcaPosibleDuplicado.findMany({
      where: { estado: 'pendiente_confirmacion' },
      include: { facturaOriginal: true, facturaCandidata: true },
      orderBy: { creadaEn: 'asc' },
    });
    return filas.map((fila) => ({
      id: fila.id,
      facturaOriginalId: fila.facturaOriginalId,
      facturaCandidataId: fila.facturaCandidataId,
      metodoDeteccion: fila.metodoDeteccion,
      estado: fila.estado,
      resueltoEn: fila.resueltoEn,
      creadaEn: fila.creadaEn,
      facturaOriginal: aDominio(fila.facturaOriginal),
      facturaCandidata: aDominio(fila.facturaCandidata),
    }));
  }

  async resolver(marcaId: string, resolucion: 'duplicado' | 'distinto'): Promise<MarcaPosibleDuplicado> {
    const marca = await this.prisma.marcaPosibleDuplicado.findUnique({ where: { id: marcaId } });
    if (!marca) {
      throw new NotFoundException(`Marca de duplicado ${marcaId} no encontrada`);
    }
    if (marca.estado !== 'pendiente_confirmacion') {
      throw new NotFoundException(`La marca ${marcaId} ya fue resuelta`);
    }

    return this.prisma.marcaPosibleDuplicado.update({
      where: { id: marcaId },
      data: {
        estado: resolucion === 'duplicado' ? 'duplicado_confirmado' : 'confirmado_distinto',
        resueltoEn: new Date(),
      },
    });
  }
}
