-- Coincidencia difusa de nombre de comercio (research.md § 6) — solo esta
-- extensión, sin unaccent: el acento se elimina en JS al normalizar antes de
-- guardar (ver duplicate-matching.service.ts), no en SQL.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "MetodoDeteccionDuplicado" AS ENUM ('cufe_exacto', 'comercio_fecha_total_similar');

-- CreateEnum
CREATE TYPE "EstadoMarcaDuplicado" AS ENUM ('duplicado_confirmado', 'pendiente_confirmacion', 'confirmado_distinto');

-- AlterTable
ALTER TABLE "facturas" ADD COLUMN     "comercioNombreNormalizado" TEXT;

-- CreateTable
CREATE TABLE "marcas_posible_duplicado" (
    "id" TEXT NOT NULL,
    "facturaOriginalId" TEXT NOT NULL,
    "facturaCandidataId" TEXT NOT NULL,
    "metodoDeteccion" "MetodoDeteccionDuplicado" NOT NULL,
    "estado" "EstadoMarcaDuplicado" NOT NULL DEFAULT 'pendiente_confirmacion',
    "resueltoEn" TIMESTAMP(3),
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marcas_posible_duplicado_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "marcas_posible_duplicado" ADD CONSTRAINT "marcas_posible_duplicado_facturaOriginalId_fkey" FOREIGN KEY ("facturaOriginalId") REFERENCES "facturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marcas_posible_duplicado" ADD CONSTRAINT "marcas_posible_duplicado_facturaCandidataId_fkey" FOREIGN KEY ("facturaCandidataId") REFERENCES "facturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
