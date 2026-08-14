-- AlterTable
ALTER TABLE "facturas" ALTER COLUMN "impuestoConsumoCentavos" SET DATA TYPE BIGINT,
ALTER COLUMN "propinaCentavos" SET DATA TYPE BIGINT,
ALTER COLUMN "subtotalCentavos" SET DATA TYPE BIGINT,
ALTER COLUMN "totalCentavos" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "items_factura" ALTER COLUMN "valorUnitarioCentavos" SET DATA TYPE BIGINT,
ALTER COLUMN "valorTotalCentavos" SET DATA TYPE BIGINT;
