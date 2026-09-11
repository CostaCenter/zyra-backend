-- Finalización de entrenamientos: estado completado + tasa de asistencia de la sesión

ALTER TABLE club_eventos
  ADD COLUMN IF NOT EXISTS completado_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS asistencia_real_pct INTEGER;

CREATE INDEX IF NOT EXISTS idx_club_eventos_completado
  ON club_eventos (completado_at)
  WHERE completado_at IS NOT NULL;
