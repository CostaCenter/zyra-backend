-- migrations/009_grupo_equipos.sql

CREATE TABLE grupo_equipos (
    id                  SERIAL PRIMARY KEY,
    grupo_division_id   INTEGER NOT NULL REFERENCES grupos_divisiones(id),
    team_id             INTEGER NOT NULL REFERENCES "Team"(id),
    creado_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_grupo_team UNIQUE (grupo_division_id, team_id)
);

CREATE INDEX idx_grupo_equipos_grupo ON grupo_equipos (grupo_division_id);
