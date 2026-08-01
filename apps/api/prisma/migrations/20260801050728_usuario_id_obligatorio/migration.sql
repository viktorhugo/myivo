/*
  Warnings:

  - Made the column `usuarioId` on table `facturas` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "facturas" DROP CONSTRAINT "facturas_usuarioId_fkey";

-- AlterTable
ALTER TABLE "facturas" ALTER COLUMN "usuarioId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
