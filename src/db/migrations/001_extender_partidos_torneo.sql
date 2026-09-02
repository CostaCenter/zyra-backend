-- migrations/001_extender_partidos_torneo.sql

ALTER TABLE partidos
  ALTER COLUMN reserva_id DROP NOT NULL;

ALTER TABLE partidos
  ADD COLUMN torneo_id INTEGER REFERENCES torneos(id),
  ADD COLUMN fase_torneo_id INTEGER REFERENCES fases_torneo(id),
  ADD COLUMN grupo_division_id INTEGER REFERENCES grupos_divisiones(id),
  ADD COLUMN nivel_arbitraje VARCHAR(10) NOT NULL DEFAULT 'BASICO';

ALTER TABLE partidos
  ADD CONSTRAINT chk_nivel_arbitraje CHECK (nivel_arbitraje IN ('BASICO', 'AVANZADO'));

-- Nuevos estados de partido necesarios para el flujo de torneo
-- (agregar a la lógica de aplicación donde se valide `state`, no hay ENUM de Postgres):
-- 'PROGRAMADO'   -> fixture generado, aún sin jugar
-- 'EN_CURSO'     -> partido siendo arbitrado en este momento
-- 'WALKOVER'     -> un equipo no se presentó
-- (mantener los existentes: pendiente, finalizado, DISPUTA, etc.)
