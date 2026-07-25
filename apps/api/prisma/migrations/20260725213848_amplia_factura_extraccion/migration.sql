-- CreateEnum
CREATE TYPE "MedioPago" AS ENUM ('efectivo', 'tarjeta_debito', 'tarjeta_credito', 'transferencia_pse', 'billetera_digital');

-- CreateEnum
CREATE TYPE "CufeOrigen" AS ENUM ('qr', 'ocr_respaldo');

-- AlterTable
ALTER TABLE "facturas" ADD COLUMN     "adquirienteIdentificacion" TEXT,
ADD COLUMN     "adquirienteNombre" TEXT,
ADD COLUMN     "comercioNIT" TEXT,
ADD COLUMN     "comercioNombre" TEXT,
ADD COLUMN     "confianzaCampos" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "cufe" TEXT,
ADD COLUMN     "cufeOrigen" "CufeOrigen",
ADD COLUMN     "fechaHoraCompra" TIMESTAMP(3),
ADD COLUMN     "impuestoConsumoCentavos" INTEGER,
ADD COLUMN     "ivaPorTarifa" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "medioPago" "MedioPago",
ADD COLUMN     "moneda" TEXT NOT NULL DEFAULT 'COP',
ADD COLUMN     "propinaCentavos" INTEGER,
ADD COLUMN     "subtotalCentavos" INTEGER,
ADD COLUMN     "totalCentavos" INTEGER;

-- CreateTable
CREATE TABLE "items_factura" (
    "id" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "descripcion" TEXT,
    "cantidad" DOUBLE PRECISION,
    "valorUnitarioCentavos" INTEGER,
    "valorTotalCentavos" INTEGER,
    "nivelConfianza" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "items_factura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correcciones_manuales" (
    "id" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "campo" TEXT NOT NULL,
    "valorExtraidoOriginal" TEXT NOT NULL,
    "valorCorregido" TEXT NOT NULL,
    "corregidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "correcciones_manuales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extracciones_crudas" (
    "id" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "jsonCrudo" JSONB NOT NULL,
    "versionPrompt" TEXT NOT NULL,
    "versionModelo" TEXT NOT NULL,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extracciones_crudas_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "items_factura" ADD CONSTRAINT "items_factura_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correcciones_manuales" ADD CONSTRAINT "correcciones_manuales_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracciones_crudas" ADD CONSTRAINT "extracciones_crudas_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
