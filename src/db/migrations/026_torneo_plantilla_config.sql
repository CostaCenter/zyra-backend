-- migrations/026_torneo_plantilla_config.sql
-- Posición, mano hábil y rol líbero por jugador en torneo.

ALTER TABLE torneo_plantilla
  ADD COLUMN IF NOT EXISTS posicion_torneo VARCHAR(30),
  ADD COLUMN IF NOT EXISTS mano_habil_torneo VARCHAR(20),
  ADD COLUMN IF NOT EXISTS es_libero BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE torneo_plantilla
  DROP CONSTRAINT IF EXISTS chk_mano_habil_torneo;

ALTER TABLE torneo_plantilla
  ADD CONSTRAINT chk_mano_habil_torneo
    CHECK (
      mano_habil_torneo IS NULL
      OR mano_habil_torneo IN ('DERECHA', 'IZQUIERDA', 'AMBIDIESTRO')
    );
