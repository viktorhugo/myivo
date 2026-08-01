-- specs/006-multi-usuario/research.md § 3 — Row-Level Security como segunda
-- capa de aislamiento entre cuentas, además del `usuarioId` explícito que ya
-- llevan las consultas a nivel de aplicación (data-model.md § Aislamiento a
-- dos capas). Ninguna de las dos capas sustituye a la otra.
--
-- Origen editable de este SQL: apps/api/prisma/rls-policies.sql (ese archivo
-- no se ejecuta directamente — este migration.sql, generado con
-- `prisma migrate dev --create-only`, es la copia que Prisma sí aplica y
-- registra en su historial de migraciones).
--
-- FORCE ROW LEVEL SECURITY (no solo ENABLE): esta instancia usa un único rol
-- de Postgres para todo (el mismo que crea las tablas y el que usa la API en
-- runtime — ver DATABASE_URL en apps/api/.env). Con ENABLE a secas, Postgres
-- exime al dueño de la tabla de sus propias políticas; FORCE la aplica
-- también a ese rol. La alternativa "correcta a mayor escala" (un rol
-- separado solo para administración, con BYPASSRLS, y el rol de runtime sin
-- ese privilegio) se descarta aquí por la complejidad operativa que
-- agregaría a una instancia personal/familiar de un solo rol — research.md
-- no profundizó en esto porque es una decisión de despliegue, no de código;
-- reconsiderar si esta instancia alguna vez pasa a tener administración
-- separada del uso normal.

ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturas FORCE ROW LEVEL SECURITY;

CREATE POLICY aislamiento_por_cuenta ON facturas
  USING ("usuarioId" = current_setting('app.usuario_id', true));

-- Las tablas que dependen de Factura se aíslan vía join a facturas, no con
-- su propia columna usuarioId (data-model.md § Aislamiento a dos capas —
-- MarcaPosibleDuplicado en particular solo necesita comparar contra una de
-- las dos facturas del par, porque la detección ya está acotada a una sola
-- cuenta antes de crear el registro: FR-006).

ALTER TABLE items_factura ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_factura FORCE ROW LEVEL SECURITY;
CREATE POLICY aislamiento_por_cuenta ON items_factura
  USING (EXISTS (
    SELECT 1 FROM facturas
    WHERE facturas.id = items_factura."facturaId"
      AND facturas."usuarioId" = current_setting('app.usuario_id', true)
  ));

ALTER TABLE correcciones_manuales ENABLE ROW LEVEL SECURITY;
ALTER TABLE correcciones_manuales FORCE ROW LEVEL SECURITY;
CREATE POLICY aislamiento_por_cuenta ON correcciones_manuales
  USING (EXISTS (
    SELECT 1 FROM facturas
    WHERE facturas.id = correcciones_manuales."facturaId"
      AND facturas."usuarioId" = current_setting('app.usuario_id', true)
  ));

ALTER TABLE extracciones_crudas ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracciones_crudas FORCE ROW LEVEL SECURITY;
CREATE POLICY aislamiento_por_cuenta ON extracciones_crudas
  USING (EXISTS (
    SELECT 1 FROM facturas
    WHERE facturas.id = extracciones_crudas."facturaId"
      AND facturas."usuarioId" = current_setting('app.usuario_id', true)
  ));

ALTER TABLE marcas_posible_duplicado ENABLE ROW LEVEL SECURITY;
ALTER TABLE marcas_posible_duplicado FORCE ROW LEVEL SECURITY;
CREATE POLICY aislamiento_por_cuenta ON marcas_posible_duplicado
  USING (EXISTS (
    SELECT 1 FROM facturas
    WHERE facturas.id = marcas_posible_duplicado."facturaOriginalId"
      AND facturas."usuarioId" = current_setting('app.usuario_id', true)
  ));

ALTER TABLE validaciones_dian ENABLE ROW LEVEL SECURITY;
ALTER TABLE validaciones_dian FORCE ROW LEVEL SECURITY;
CREATE POLICY aislamiento_por_cuenta ON validaciones_dian
  USING (EXISTS (
    SELECT 1 FROM facturas
    WHERE facturas.id = validaciones_dian."facturaId"
      AND facturas."usuarioId" = current_setting('app.usuario_id', true)
  ));
