import { Injectable } from '@nestjs/common';
import {
  transicionar,
  type ArchivoDerivado,
  type Factura,
  type FacturaEstado,
} from '@myivo/domain';
import type {
  Factura as FacturaPrisma,
  FacturaEstado as FacturaEstadoPrisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const ESTADO_A_DOMINIO: Record<FacturaEstadoPrisma, FacturaEstado> = {
  recibida: 'recibida',
  procesando: 'procesando',
  extraida: 'extraída',
  necesita_revision: 'necesita_revisión',
  fallida: 'fallida',
};

const ESTADO_A_PRISMA: Record<FacturaEstado, FacturaEstadoPrisma> = {
  recibida: 'recibida',
  procesando: 'procesando',
  extraída: 'extraida',
  necesita_revisión: 'necesita_revision',
  fallida: 'fallida',
};

interface ArchivoDerivadoJson {
  ruta: string;
  tipoTransformacion: string;
  creadoEn: string;
}

function aDominio(fila: FacturaPrisma): Factura {
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
    creadaEn: fila.creadaEn,
    actualizadaEn: fila.actualizadaEn,
  };
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

  async obtenerPorId(id: string): Promise<Factura | null> {
    const fila = await this.prisma.factura.findUnique({ where: { id } });
    return fila ? aDominio(fila) : null;
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
}
