import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectTransaction } from '@nestjs-cls/transactional';
import { esDuplicadoExactoPorCufe, type Factura, type MarcaPosibleDuplicado } from '@myivo/domain';
import type { PrismaClient } from '@prisma/client';
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

/**
 * Proxy de "cuál factura tiene más datos" para decidir cuál conservar al
 * confirmar un duplicado (resolver() con resolucion="duplicado"): cuenta
 * campos extraídos no nulos, más la cantidad de tarifas de IVA registradas.
 * No usa `confianzaCampos` porque un campo puede estar ausente de ese mapa
 * sin ser `null` (p. ej. corregido a mano) — contar valores reales es más
 * fiel a "cuál registro quedaría con más información" que promediar confianza.
 */
function contarCamposPoblados(factura: Factura): number {
  const campos: unknown[] = [
    factura.comercioNombre,
    factura.comercioNIT,
    factura.fechaHoraCompra,
    factura.subtotalCentavos,
    factura.impuestoConsumoCentavos,
    factura.propinaCentavos,
    factura.totalCentavos,
    factura.medioPago,
    factura.adquirienteNombre,
    factura.adquirienteIdentificacion,
    factura.cufe,
  ];
  return campos.filter((valor) => valor !== null && valor !== undefined).length + factura.ivaPorTarifa.length;
}

export interface MarcaPendienteConFacturas extends MarcaPosibleDuplicado {
  facturaOriginal: Factura;
  facturaCandidata: Factura;
}

@Injectable()
export class DuplicateMatchingService {
  // Ver el comentario en factura.repository.ts sobre @InjectTransaction().
  constructor(@InjectTransaction() private readonly prisma: PrismaClient) {}

  /**
   * Detecta duplicados para una factura recién extraída y, si encuentra uno,
   * registra la marca (idempotente: no duplica una marca ya existente entre
   * el mismo par). FR-019 (CUFE exacto, automático) tiene prioridad sobre
   * FR-020 (difuso, sin CUFE) — un documento con CUFE de QR (confiable) nunca
   * pasa por el mecanismo difuso, evita falsos positivos entre dos facturas
   * electrónicas distintas que coincidan en comercio/fecha/total por
   * casualidad.
   *
   * Excepción: cuando el CUFE viene de OCR (`cufeOrigen === 'ocr_respaldo'`),
   * no es lo bastante confiable como para descartar un duplicado solo porque
   * el texto no calzó carácter por carácter — verificado con datos reales:
   * la misma foto releída dos veces produjo CUFEs distintos en un dígito. En
   * ese caso, si no hay coincidencia exacta, se cae al mecanismo difuso.
   *
   * Todas las consultas de candidatos quedan acotadas a `usuarioId` (FR-006):
   * dos cuentas que capturan la misma compra (p. ej. la comparten) nunca se
   * marcan como duplicado entre sí — cada una ve su propia copia intacta.
   */
  async detectarYRegistrar(facturaId: string, usuarioId: string): Promise<void> {
    const factura = await this.prisma.factura.findFirst({ where: { id: facturaId, usuarioId } });
    if (!factura) {
      return;
    }

    if (factura.cufe) {
      const otraConMismoCufe = await this.prisma.factura.findFirst({
        where: { id: { not: facturaId }, usuarioId, cufe: factura.cufe, eliminadaEn: null },
        orderBy: { creadaEn: 'asc' },
      });
      if (otraConMismoCufe && esDuplicadoExactoPorCufe(factura.cufe, otraConMismoCufe.cufe)) {
        await this.registrarSiNoExiste(otraConMismoCufe.id, facturaId, 'cufe_exacto', 'duplicado_confirmado');
        return;
      }

      if (factura.cufeOrigen !== 'ocr_respaldo') {
        return;
      }
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
        AND "usuarioId" = ${usuarioId}::uuid
        AND "eliminadaEn" IS NULL
        AND (cufe IS NULL OR "cufeOrigen" = 'ocr_respaldo')
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

  /**
   * Cada marca pendiente, con las dos facturas candidatas completas
   * (contracts/api.md). Excluye marcas donde cualquiera de las dos facturas
   * ya fue eliminada (FR-009) — no tiene sentido preguntar "¿es la misma
   * compra?" sobre una factura que el usuario ya eliminó por su cuenta.
   * Acotado a `usuarioId` vía `facturaOriginal` — por construcción
   * (detectarYRegistrar) ambas facturas de un par son siempre de la misma
   * cuenta, así que filtrar por una basta (data-model.md § Aislamiento a
   * dos capas).
   */
  async obtenerPendientes(usuarioId: string): Promise<MarcaPendienteConFacturas[]> {
    const filas = await this.prisma.marcaPosibleDuplicado.findMany({
      where: {
        estado: 'pendiente_confirmacion',
        facturaOriginal: { usuarioId, eliminadaEn: null },
        facturaCandidata: { eliminadaEn: null },
      },
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

  /**
   * "distinto" solo cambia el estado de la marca (FR-020 Acceptance Scenario
   * 3: ambas quedan como registros independientes). "duplicado" además hace
   * soft-delete de una de las dos facturas del par — sin esto, confirmar que
   * son la misma compra dejaba ambas visibles para siempre, duplicando montos
   * en los agregados (bug encontrado validando el bottom sheet en navegador
   * real). Se conserva la que tenga más campos poblados (`contarCamposPoblados`)
   * — coherente con el copy ya implementado del bottom sheet ("conservamos la
   * copia con más datos"); en empate se conserva la original como desempate
   * determinista. El soft-delete reusa el mismo campo `eliminadaEn` de US2
   * (specs/002-rediseno-visual-web) — nunca purga nada (constitution Principio I).
   */
  async resolver(
    marcaId: string,
    usuarioId: string,
    resolucion: 'duplicado' | 'distinto',
  ): Promise<MarcaPosibleDuplicado> {
    const marca = await this.prisma.marcaPosibleDuplicado.findFirst({
      where: { id: marcaId, facturaOriginal: { usuarioId } },
      include: { facturaOriginal: true, facturaCandidata: true },
    });
    if (!marca) {
      throw new NotFoundException(`Marca de duplicado ${marcaId} no encontrada`);
    }
    if (marca.estado !== 'pendiente_confirmacion') {
      throw new NotFoundException(`La marca ${marcaId} ya fue resuelta`);
    }

    if (resolucion === 'duplicado') {
      const original = aDominio(marca.facturaOriginal);
      const candidata = aDominio(marca.facturaCandidata);
      const idAEliminar =
        contarCamposPoblados(candidata) <= contarCamposPoblados(original) ? candidata.id : original.id;
      await this.prisma.factura.update({
        where: { id: idAEliminar },
        data: { eliminadaEn: new Date() },
      });
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
