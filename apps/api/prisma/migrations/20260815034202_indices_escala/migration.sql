-- CreateIndex
CREATE INDEX "facturas_usuarioId_eliminadaEn_fechaHoraCompra_idx" ON "facturas"("usuarioId", "eliminadaEn", "fechaHoraCompra");

-- CreateIndex
CREATE INDEX "facturas_usuarioId_cufe_idx" ON "facturas"("usuarioId", "cufe");

-- Índice GIN trgm (US7, specs/007-despliegue-produccion/research.md § 9) —
-- acelera la coincidencia difusa de nombre de comercio
-- (duplicate-matching.service.ts, $queryRaw con similarity()). Prisma no
-- modela `USING gin (... gin_trgm_ops)` de forma nativa en schema.prisma,
-- por eso se agrega a mano en esta migración generada con --create-only
-- (mismo patrón ya usado en 20260801043357_rls_policies para las políticas
-- RLS). pg_trgm ya está instalado desde 20260727002612_marcas_duplicado.
CREATE INDEX "facturas_comercioNombreNormalizado_trgm_idx" ON "facturas" USING gin ("comercioNombreNormalizado" gin_trgm_ops);
