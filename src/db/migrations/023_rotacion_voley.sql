-- Alineación pre-partido (capitanes) y estado de rotación en vivo
ALTER TABLE partidos
  ADD COLUMN IF NOT EXISTS alineacion_local JSONB,
  ADD COLUMN IF NOT EXISTS alineacion_visitante JSONB,
  ADD COLUMN IF NOT EXISTS equipo_que_saca_inicial VARCHAR(12);

ALTER TABLE marcadores_detalle
  ADD COLUMN IF NOT EXISTS posiciones_actuales JSONB NOT NULL DEFAULT '{"equipo_local":null,"equipo_visitante":null}'::jsonb,
  ADD COLUMN IF NOT EXISTS equipo_que_saca VARCHAR(12);

COMMENT ON COLUMN partidos.alineacion_local IS 'Array [zona1..zona6] de user_id — alineación inicial equipo local';
COMMENT ON COLUMN partidos.alineacion_visitante IS 'Array [zona1..zona6] de user_id — alineación inicial equipo visitante';
COMMENT ON COLUMN partidos.equipo_que_saca_inicial IS 'local | visitante — quién saca al inicio del partido';
COMMENT ON COLUMN marcadores_detalle.posiciones_actuales IS 'Posiciones actuales por zona { equipo_local: [6 ids], equipo_visitante: [6 ids] }';
COMMENT ON COLUMN marcadores_detalle.equipo_que_saca IS 'local | visitante — equipo que tiene el saque actualmente';
