-- CreateEnum
CREATE TYPE "MetodoValidacionDian" AS ENUM ('manual', 'conciliacion');

-- CreateEnum
CREATE TYPE "ResultadoValidacionDian" AS ENUM ('valido_vigente', 'no_encontrado', 'anulado_reemplazado', 'otro');

-- CreateTable
CREATE TABLE "validaciones_dian" (
    "id" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "metodo" "MetodoValidacionDian" NOT NULL,
    "resultado" "ResultadoValidacionDian" NOT NULL,
    "snapshotComercioNombre" TEXT,
    "snapshotTotalCentavos" INTEGER,
    "snapshotMoneda" TEXT NOT NULL,
    "snapshotFechaHoraCompra" TIMESTAMP(3),
    "snapshotCufe" TEXT NOT NULL,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "validaciones_dian_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "validaciones_dian" ADD CONSTRAINT "validaciones_dian_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
