import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  evaluarElegibilidad2026,
  medioPagoSchema,
  tipoDocumentoSchema,
  transicionar,
  type ArchivoDerivado,
  type ConfianzaCampos,
  type CorreccionManual,
  type Factura,
  type FacturaEstado,
  type ItemFactura,
  type IvaTarifa,
  type MedioPago,
  type TipoDocumento,
} from '@myivo/domain';
import { Prisma } from '@prisma/client';
import type {
  Factura as FacturaPrisma,
  FacturaEstado as FacturaEstadoPrisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { FiltrosFactura } from './dto/filtrar-facturas.dto';
import { normalizarNombreComercio } from './duplicate-matching.service';

const ESTADO_A_DOMINIO: Record<FacturaEstadoPrisma, FacturaEstado> = {
  recibida: 'recibida',
  procesando: 'procesando',
  extraida: 'extraída',
  necesita_revision: 'necesita_revisión',
  fallida: 'fallida',
  varias_facturas: 'varias_facturas',
};

const ESTADO_A_PRISMA: Record<FacturaEstado, FacturaEstadoPrisma> = {
  recibida: 'recibida',
  procesando: 'procesando',
  extraída: 'extraida',
  necesita_revisión: 'necesita_revision',
  fallida: 'fallida',
  varias_facturas: 'varias_facturas',
};

interface ArchivoDerivadoJson {
  ruta: string;
  tipoTransformacion: string;
  creadoEn: string;
}

/** Exportado para reutilizar en DuplicateMatchingService (mapea las facturas candidatas embebidas). */
export function aDominio(fila: FacturaPrisma): Factura {
  const derivadosJson = fila.derivados as unknown as ArchivoDerivadoJson[];
  const derivados: ArchivoDerivado[] = derivadosJson.map((derivado) => ({
    ...derivado,
    creadoEn: new Date(derivado.creadoEn),
  }));

  return {
    id: fila.id,
    estado: ESTADO_A_DOMINIO[fila.estado],
    rutaImagenOriginal: fila.rutaImagenOriginal,
    derivados,
    comercioNombre: fila.comercioNombre,
    comercioNIT: fila.comercioNIT,
    fechaHoraCompra: fila.fechaHoraCompra,
    moneda: fila.moneda,
    subtotalCentavos: fila.subtotalCentavos,
    ivaPorTarifa: fila.ivaPorTarifa as unknown as IvaTarifa[],
    impuestoConsumoCentavos: fila.impuestoConsumoCentavos,
    propinaCentavos: fila.propinaCentavos,
    totalCentavos: fila.totalCentavos,
    medioPago: fila.medioPago,
    adquirienteNombre: fila.adquirienteNombre,
    adquirienteIdentificacion: fila.adquirienteIdentificacion,
    cufe: fila.cufe,
    cufeOrigen: fila.cufeOrigen,
    confianzaCampos: fila.confianzaCampos as unknown as ConfianzaCampos,
    tipoDocumento: fila.tipoDocumento,
    elegibilidadTributaria: fila.elegibilidadTributaria,
    elegibilidadMotivo: fila.elegibilidadMotivo,
    creadaEn: fila.creadaEn,
    actualizadaEn: fila.actualizadaEn,
    eliminadaEn: fila.eliminadaEn,
  };
}

/** Campos que produce la extracción (US2) + clasificación tributaria (US3) — ver `data-model.md` § Factura. */
export type CamposExtraidosFactura = Pick<
  Factura,
  | 'comercioNombre'
  | 'comercioNIT'
  | 'fechaHoraCompra'
  | 'moneda'
  | 'subtotalCentavos'
  | 'ivaPorTarifa'
  | 'impuestoConsumoCentavos'
  | 'propinaCentavos'
  | 'totalCentavos'
  | 'medioPago'
  | 'adquirienteNombre'
  | 'adquirienteIdentificacion'
  | 'cufe'
  | 'cufeOrigen'
  | 'confianzaCampos'
  | 'tipoDocumento'
  | 'elegibilidadTributaria'
  | 'elegibilidadMotivo'
>;

export type ItemFacturaInput = Omit<ItemFactura, 'id' | 'facturaId'>;

export interface ExtraccionCrudaInput {
  jsonCrudo: unknown;
  versionPrompt: string;
  versionModelo: string;
}

export interface ResultadoListado {
  items: Factura[];
  conteo: number;
  /** Centavos. Solo suma documentos en COP (FR-027). */
  sumaTotal: number;
}

function parsearEntero(valor: string): number {
  const numero = Number(valor);
  if (!Number.isInteger(numero)) {
    throw new BadRequestException(`Valor no es un entero válido: "${valor}"`);
  }
  return numero;
}

function parsearFecha(valor: string): Date {
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) {
    throw new BadRequestException(`Fecha inválida: "${valor}"`);
  }
  return fecha;
}

function parsearMedioPago(valor: string): MedioPago {
  const resultado = medioPagoSchema.safeParse(valor);
  if (!resultado.success) {
    throw new BadRequestException(`medioPago inválido: "${valor}"`);
  }
  return resultado.data;
}

function parsearTipoDocumento(valor: string): TipoDocumento {
  const resultado = tipoDocumentoSchema.safeParse(valor);
  if (!resultado.success) {
    throw new BadRequestException(`tipoDocumento inválido: "${valor}"`);
  }
  return resultado.data;
}

function parsearTexto(valor: string): string {
  return valor;
}

/**
 * Campos corregibles vía `PATCH /invoices/:id/fields` (FR-011/FR-012). El
 * nombre público (clave) es el usado en la API y guardado en
 * `CorreccionManual.campo` — puede diferir del nombre de columna de Prisma
 * (p. ej. "total" -> `totalCentavos`) porque el primero es de negocio y el
 * segundo expone su unidad. No es una lista exhaustiva de columnas de
 * Factura: solo las que tiene sentido corregir a mano (no `id`, `estado`,
 * `derivados`, etc.) — evita que el endpoint se convierta en una escritura
 * arbitraria de columnas.
 */
const CAMPOS_CORREGIBLES: Record<
  string,
  { columna: keyof Prisma.FacturaUpdateInput; parsear: (valor: string) => unknown }
> = {
  comercioNombre: { columna: 'comercioNombre', parsear: parsearTexto },
  comercioNIT: { columna: 'comercioNIT', parsear: parsearTexto },
  fechaHoraCompra: { columna: 'fechaHoraCompra', parsear: parsearFecha },
  moneda: { columna: 'moneda', parsear: parsearTexto },
  subtotal: { columna: 'subtotalCentavos', parsear: parsearEntero },
  impuestoConsumo: { columna: 'impuestoConsumoCentavos', parsear: parsearEntero },
  propina: { columna: 'propinaCentavos', parsear: parsearEntero },
  total: { columna: 'totalCentavos', parsear: parsearEntero },
  medioPago: { columna: 'medioPago', parsear: parsearMedioPago },
  adquirienteNombre: { columna: 'adquirienteNombre', parsear: parsearTexto },
  adquirienteIdentificacion: { columna: 'adquirienteIdentificacion', parsear: parsearTexto },
  cufe: { columna: 'cufe', parsear: parsearTexto },
  // NO incluir elegibilidadTributaria/elegibilidadMotivo aquí — son siempre
  // CALCULADOS (FR-016), nunca editables a mano.
  tipoDocumento: { columna: 'tipoDocumento', parsear: parsearTipoDocumento },
};

/** Columnas que alimentan el cálculo de elegibilidad (FR-015) — corregirlas dispara el recálculo (FR-017). */
const CAMPOS_QUE_AFECTAN_ELEGIBILIDAD = new Set<keyof Prisma.FacturaUpdateInput>([
  'tipoDocumento',
  'adquirienteIdentificacion',
  'medioPago',
]);

function serializarValorOriginal(valor: unknown): string {
  if (valor === null || valor === undefined) {
    return 'null';
  }
  if (valor instanceof Date) {
    return valor.toISOString();
  }
  return String(valor);
}

@Injectable()
export class FacturaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async crear(rutaImagenOriginal: string): Promise<Factura> {
    const fila = await this.prisma.factura.create({
      data: { rutaImagenOriginal },
    });
    return aDominio(fila);
  }

  /** Excluye por defecto los registros con soft-delete (FR-009) — equivalente a "no encontrado". */
  async obtenerPorId(id: string): Promise<Factura | null> {
    const fila = await this.prisma.factura.findFirst({ where: { id, eliminadaEn: null } });
    return fila ? aDominio(fila) : null;
  }

  /**
   * Soft-delete (FR-009/FR-029, constitution Principio I): marca `eliminadaEn`
   * sin tocar ningún otro campo ni el archivo original. Idempotente por
   * construcción — `obtenerPorId` ya excluye una factura ya eliminada, así
   * que reintentar sobre ella devuelve `null` en vez de un segundo efecto.
   * Devuelve `null` si el id no existe o ya estaba eliminada.
   */
  async eliminar(id: string): Promise<Factura | null> {
    const actual = await this.obtenerPorId(id);
    if (!actual) {
      return null;
    }
    const fila = await this.prisma.factura.update({
      where: { id },
      data: { eliminadaEn: new Date() },
    });
    return aDominio(fila);
  }

  /**
   * Añade un archivo derivado al registro (constitution Principio I: el
   * derivado se vincula al original, nunca lo reemplaza). Se lee y reescribe
   * la lista completa porque `derivados` es una columna JSON, no una tabla.
   */
  async registrarDerivado(id: string, derivado: ArchivoDerivado): Promise<void> {
    const fila = await this.prisma.factura.findUnique({ where: { id } });
    if (!fila) {
      return;
    }

    const existentes = fila.derivados as unknown as ArchivoDerivadoJson[];
    const sinEseTipo = existentes.filter(
      (existente) => existente.tipoTransformacion !== derivado.tipoTransformacion,
    );
    const actualizados: ArchivoDerivadoJson[] = [
      ...sinEseTipo,
      {
        ruta: derivado.ruta,
        tipoTransformacion: derivado.tipoTransformacion,
        creadoEn: derivado.creadoEn.toISOString(),
      },
    ];

    await this.prisma.factura.update({
      where: { id },
      data: { derivados: actualizados as unknown as Prisma.InputJsonValue },
    });
  }

  /**
   * Lista filtrable (FR-022): todos los filtros son combinables (AND). El
   * agregado `sumaTotal` refleja el mismo filtro pero solo suma documentos
   * en COP (FR-027) — `conteo` sí incluye documentos en otras monedas,
   * porque no es un agregado monetario.
   */
  async listar(filtros: FiltrosFactura): Promise<ResultadoListado> {
    // Excluidas por defecto (FR-009) — sin flag para incluirlas, esta feature no trae papelera.
    const where: Prisma.FacturaWhereInput = { eliminadaEn: null };

    if (filtros.fechaDesde || filtros.fechaHasta) {
      const filtroFecha: Prisma.DateTimeNullableFilter = {};
      if (filtros.fechaDesde) filtroFecha.gte = filtros.fechaDesde;
      if (filtros.fechaHasta) filtroFecha.lte = filtros.fechaHasta;
      where.fechaHoraCompra = filtroFecha;
    }
    if (filtros.comercio) {
      where.comercioNombre = { contains: filtros.comercio, mode: 'insensitive' };
    }
    if (filtros.montoMin !== undefined || filtros.montoMax !== undefined) {
      const filtroMonto: Prisma.IntNullableFilter = {};
      if (filtros.montoMin !== undefined) filtroMonto.gte = filtros.montoMin;
      if (filtros.montoMax !== undefined) filtroMonto.lte = filtros.montoMax;
      where.totalCentavos = filtroMonto;
    }
    if (filtros.tipoDocumento) {
      where.tipoDocumento = filtros.tipoDocumento;
    }
    if (filtros.elegibilidad !== undefined) {
      where.elegibilidadTributaria = filtros.elegibilidad;
    }
    if (filtros.estado) {
      where.estado = ESTADO_A_PRISMA[filtros.estado];
    }

    const [filas, conteo, agregado] = await Promise.all([
      this.prisma.factura.findMany({ where, orderBy: { creadaEn: 'desc' } }),
      this.prisma.factura.count({ where }),
      this.prisma.factura.aggregate({
        where: { ...where, moneda: 'COP' },
        _sum: { totalCentavos: true },
      }),
    ]);

    return {
      items: filas.map(aDominio),
      conteo,
      sumaTotal: agregado._sum.totalCentavos ?? 0,
    };
  }

  async obtenerItems(facturaId: string): Promise<ItemFactura[]> {
    const filas = await this.prisma.itemFactura.findMany({ where: { facturaId } });
    return filas.map((fila) => ({
      id: fila.id,
      facturaId: fila.facturaId,
      descripcion: fila.descripcion,
      cantidad: fila.cantidad,
      valorUnitarioCentavos: fila.valorUnitarioCentavos,
      valorTotalCentavos: fila.valorTotalCentavos,
      nivelConfianza: fila.nivelConfianza,
    }));
  }

  async obtenerCorrecciones(facturaId: string): Promise<CorreccionManual[]> {
    const filas = await this.prisma.correccionManual.findMany({
      where: { facturaId },
      orderBy: { corregidoEn: 'asc' },
    });
    return filas.map((fila) => ({
      id: fila.id,
      facturaId: fila.facturaId,
      campo: fila.campo,
      valorExtraidoOriginal: fila.valorExtraidoOriginal,
      valorCorregido: fila.valorCorregido,
      corregidoEn: fila.corregidoEn,
    }));
  }

  /** Valida la transición contra la máquina de estados antes de persistir. */
  async actualizarEstado(id: string, nuevoEstado: FacturaEstado): Promise<Factura> {
    const actual = await this.obtenerPorId(id);
    if (!actual) {
      throw new Error(`Factura ${id} no encontrada`);
    }

    transicionar(actual.estado, nuevoEstado);

    const fila = await this.prisma.factura.update({
      where: { id },
      data: { estado: ESTADO_A_PRISMA[nuevoEstado] },
    });
    return aDominio(fila);
  }

  /**
   * Persiste el resultado de un intento de extracción: reemplaza los ítems
   * (un reprocesamiento no debe duplicarlos) y actualiza los campos
   * extraídos de la Factura, en una sola transacción. NO toca `estado` — eso
   * siempre pasa por `actualizarEstado` para no crear una segunda ruta de
   * transición que se salte la máquina de estados.
   */
  async guardarResultadoExtraccion(
    facturaId: string,
    campos: CamposExtraidosFactura,
    items: ItemFacturaInput[],
  ): Promise<Factura> {
    const [, , fila] = await this.prisma.$transaction([
      this.prisma.itemFactura.deleteMany({ where: { facturaId } }),
      this.prisma.itemFactura.createMany({
        data: items.map((item) => ({ ...item, facturaId })),
      }),
      this.prisma.factura.update({
        where: { id: facturaId },
        data: {
          comercioNombre: campos.comercioNombre,
          comercioNombreNormalizado: campos.comercioNombre
            ? normalizarNombreComercio(campos.comercioNombre)
            : null,
          comercioNIT: campos.comercioNIT,
          fechaHoraCompra: campos.fechaHoraCompra,
          moneda: campos.moneda,
          subtotalCentavos: campos.subtotalCentavos,
          ivaPorTarifa: campos.ivaPorTarifa as unknown as Prisma.InputJsonValue,
          impuestoConsumoCentavos: campos.impuestoConsumoCentavos,
          propinaCentavos: campos.propinaCentavos,
          totalCentavos: campos.totalCentavos,
          medioPago: campos.medioPago,
          adquirienteNombre: campos.adquirienteNombre,
          adquirienteIdentificacion: campos.adquirienteIdentificacion,
          cufe: campos.cufe,
          cufeOrigen: campos.cufeOrigen,
          confianzaCampos: campos.confianzaCampos as unknown as Prisma.InputJsonValue,
          tipoDocumento: campos.tipoDocumento,
          elegibilidadTributaria: campos.elegibilidadTributaria,
          elegibilidadMotivo: campos.elegibilidadMotivo,
        },
      }),
    ]);
    return aDominio(fila);
  }

  /** Constitution Principio III: preserva la salida cruda del proveedor de extracción. */
  async registrarExtraccionCruda(facturaId: string, datos: ExtraccionCrudaInput): Promise<void> {
    await this.prisma.extraccionCruda.create({
      data: {
        facturaId,
        jsonCrudo: datos.jsonCrudo as Prisma.InputJsonValue,
        versionPrompt: datos.versionPrompt,
        versionModelo: datos.versionModelo,
      },
    });
  }

  /**
   * Aplica una corrección manual a un campo (FR-011/FR-012): guarda el valor
   * extraído original (antes de sobrescribirlo) en `CorreccionManual` y
   * actualiza la Factura. Si el campo corregido alimenta la elegibilidad
   * (`tipoDocumento`, `adquirienteIdentificacion`, `medioPago`), recalcula y
   * persiste `elegibilidadTributaria`/`elegibilidadMotivo` en la misma
   * transacción (FR-017) — nunca queda un estado intermedio inconsistente.
   */
  async aplicarCorreccion(
    facturaId: string,
    campo: string,
    valorCorregido: string,
    identificacionesPropias: readonly string[],
  ): Promise<Factura> {
    const definicion = CAMPOS_CORREGIBLES[campo];
    if (!definicion) {
      throw new BadRequestException(`Campo no corregible: "${campo}"`);
    }

    const actual = await this.prisma.factura.findUnique({ where: { id: facturaId } });
    if (!actual) {
      throw new NotFoundException(`Factura ${facturaId} no encontrada`);
    }

    const valorParseado = definicion.parsear(valorCorregido);
    const valorOriginalTexto = serializarValorOriginal(
      actual[definicion.columna as keyof FacturaPrisma],
    );

    const fila = await this.prisma.$transaction(async (tx) => {
      await tx.correccionManual.create({
        data: { facturaId, campo, valorExtraidoOriginal: valorOriginalTexto, valorCorregido },
      });

      const datosActualizacion: Prisma.FacturaUpdateInput = { [definicion.columna]: valorParseado };
      if (definicion.columna === 'comercioNombre') {
        datosActualizacion.comercioNombreNormalizado =
          typeof valorParseado === 'string' ? normalizarNombreComercio(valorParseado) : null;
      }

      let filaActualizada = await tx.factura.update({
        where: { id: facturaId },
        data: datosActualizacion,
      });

      if (CAMPOS_QUE_AFECTAN_ELEGIBILIDAD.has(definicion.columna)) {
        const resultado = evaluarElegibilidad2026(
          {
            tipoDocumento: filaActualizada.tipoDocumento ?? 'desconocido',
            adquirienteIdentificacion: filaActualizada.adquirienteIdentificacion,
            medioPago: filaActualizada.medioPago,
          },
          identificacionesPropias,
        );
        filaActualizada = await tx.factura.update({
          where: { id: facturaId },
          data: {
            elegibilidadTributaria: resultado.elegible,
            elegibilidadMotivo: resultado.motivo,
          },
        });
      }

      return filaActualizada;
    });

    return aDominio(fila);
  }
}
