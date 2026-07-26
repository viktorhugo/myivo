-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('factura_electronica', 'documento_equivalente_pos', 'documento_soporte', 'otro', 'desconocido');

-- AlterTable
ALTER TABLE "facturas" ADD COLUMN     "elegibilidadMotivo" TEXT,
ADD COLUMN     "elegibilidadTributaria" BOOLEAN,
ADD COLUMN     "tipoDocumento" "TipoDocumento";
