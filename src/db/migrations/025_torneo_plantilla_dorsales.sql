-- migrations/025_torneo_plantilla_dorsales.sql
-- Dorsal por jugador específico de un torneo (independiente del dorsal habitual del equipo).

CREATE TABLE torneo_plantilla (
    id              SERIAL PRIMARY KEY,
    torneo_id       INTEGER NOT NULL REFERENCES torneos(id) ON DELETE CASCADE,
    team_id         INTEGER NOT NULL REFERENCES "Team"(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    dorsal_torneo   SMALLINT,
    creado_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    actualizado_at  TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_dorsal_torneo_rango
      CHECK (dorsal_torneo IS NULL OR (dorsal_torneo >= 0 AND dorsal_torneo <= 99))
);

CREATE UNIQUE INDEX uq_torneo_plantilla_jugador
  ON torneo_plantilla (torneo_id, team_id, user_id);

CREATE UNIQUE INDEX uq_torneo_plantilla_dorsal
  ON torneo_plantilla (torneo_id, team_id, dorsal_torneo)
  WHERE dorsal_torneo IS NOT NULL;
