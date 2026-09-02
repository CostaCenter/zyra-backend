-- migrations/007_visibilidad_torneo.sql
-- Visibilidad opcional de torneos (público / privado con código de acceso).

ALTER TABLE torneos
  ADD COLUMN visibilidad VARCHAR(10) NOT NULL DEFAULT 'PUBLICO',
  ADD COLUMN codigo_acceso VARCHAR(10);

ALTER TABLE torneos
  ADD CONSTRAINT chk_visibilidad CHECK (visibilidad IN ('PUBLICO', 'PRIVADO'));
