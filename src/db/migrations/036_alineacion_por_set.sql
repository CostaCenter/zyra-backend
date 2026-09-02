-- Alineación por set: cada set tiene su propia nómina/alineación (partido_id + set_numero)

ALTER TABLE partido_nominas
  ADD COLUMN IF NOT EXISTS set_numero SMALLINT NOT NULL DEFAULT 1;

ALTER TABLE partido_nominas DROP CONSTRAINT IF EXISTS uq_partido_jugador;
ALTER TABLE partido_nominas DROP CONSTRAINT IF EXISTS uq_partido_team_dorsal;

ALTER TABLE partido_nominas
  ADD CONSTRAINT uq_partido_jugador_set UNIQUE (partido_id, user_id, set_numero);

ALTER TABLE partido_nominas
  ADD CONSTRAINT uq_partido_team_dorsal_set UNIQUE (partido_id, team_id, dorsal, set_numero);

CREATE INDEX IF NOT EXISTS idx_nominas_partido_set ON partido_nominas (partido_id, set_numero);
