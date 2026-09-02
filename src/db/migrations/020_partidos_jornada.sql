-- Jornada para fixtures round-robin (método del círculo).
-- Ejecutar: node scripts/run-migration-020-partidos-jornada.mjs

ALTER TABLE partidos
  ADD COLUMN IF NOT EXISTS jornada INTEGER;

COMMENT ON COLUMN partidos.jornada IS 'Número de jornada en round-robin (1..N-1). NULL en eliminación directa u otros formatos.';

CREATE INDEX IF NOT EXISTS idx_partidos_fase_jornada
  ON partidos (fase_torneo_id, jornada)
  WHERE jornada IS NOT NULL;
