-- CreateEnum
CREATE TYPE "FacturaEstado" AS ENUM ('recibida', 'procesando', 'extraída', 'necesita_revisión', 'fallida');

-- CreateTable
CREATE TABLE "facturas" (
    "id" TEXT NOT NULL,
    "estado" "FacturaEstado" NOT NULL DEFAULT 'recibida',
    "rutaImagenOriginal" TEXT NOT NULL,
    "derivados" JSONB NOT NULL DEFAULT '[]',
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facturas_pkey" PRIMARY KEY ("id")
);
