-- Campos para programación de horarios (momento 1 estimado + momento 2 en vivo)

ALTER TABLE partidos
  ADD COLUMN IF NOT EXISTS duracion_programada_minutos INTEGER,
  ADD COLUMN IF NOT EXISTS finalizado_en TIMESTAMPTZ;

ALTER TABLE torneos
  ADD COLUMN IF NOT EXISTS horario_actualizado_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS horario_actualizado_resumen JSONB;

COMMENT ON COLUMN partidos.duracion_programada_minutos IS 'Duración usada al programar (estimada + margen en momento 1)';
COMMENT ON COLUMN partidos.finalizado_en IS 'Hora real de cierre del partido (momento 2)';
COMMENT ON COLUMN torneos.horario_actualizado_en IS 'Última recalculación en vivo del horario';
COMMENT ON COLUMN torneos.horario_actualizado_resumen IS 'Detalle de partidos reprogramados en la última recalculación';
