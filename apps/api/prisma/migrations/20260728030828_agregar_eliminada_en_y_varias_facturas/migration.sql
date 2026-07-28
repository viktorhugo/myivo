-- AlterEnum
ALTER TYPE "FacturaEstado" ADD VALUE 'varias_facturas';

-- AlterTable
ALTER TABLE "facturas" ADD COLUMN     "eliminadaEn" TIMESTAMP(3);
