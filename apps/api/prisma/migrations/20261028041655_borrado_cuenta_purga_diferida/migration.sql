-- DropIndex
DROP INDEX "facturas_comercioNombreNormalizado_trgm_idx";

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "eliminacionProgramadaPara" TIMESTAMP(3),
ADD COLUMN     "eliminacionSolicitadaEn" TIMESTAMP(3);
