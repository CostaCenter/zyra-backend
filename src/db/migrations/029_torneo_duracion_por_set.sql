-- Duración de partido derivada de sets (reemplaza entrada manual de duracion_estimada)

ALTER TABLE torneos
  ADD COLUMN IF NOT EXISTS duracion_promedio_set_minutos INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS descanso_entre_sets_minutos INTEGER NOT NULL DEFAULT 5;

ALTER TABLE torneos
  DROP CONSTRAINT IF EXISTS chk_torneo_duracion_promedio_set;
ALTER TABLE torneos
  ADD CONSTRAINT chk_torneo_duracion_promedio_set
  CHECK (duracion_promedio_set_minutos >= 1);

ALTER TABLE torneos
  DROP CONSTRAINT IF EXISTS chk_torneo_descanso_entre_sets;
ALTER TABLE torneos
  ADD CONSTRAINT chk_torneo_descanso_entre_sets
  CHECK (descanso_entre_sets_minutos >= 0);

COMMENT ON COLUMN torneos.duracion_promedio_set_minutos IS 'Minutos promedio por set para estimar duración del partido';
COMMENT ON COLUMN torneos.descanso_entre_sets_minutos IS 'Minutos de descanso entre sets dentro del mismo partido';
