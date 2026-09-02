-- migrations/003_partido_nominas.sql

CREATE TABLE partido_nominas (
    id                  SERIAL PRIMARY KEY,
    partido_id          INTEGER NOT NULL REFERENCES partidos(id),
    team_id             INTEGER NOT NULL REFERENCES "Team"(id),
    user_id             INTEGER NOT NULL REFERENCES "user"(id),

    dorsal              SMALLINT NOT NULL,
    rol_nomina          VARCHAR(10) NOT NULL, -- 'TITULAR' | 'SUPLENTE'

    propuesto_por_id    INTEGER NOT NULL REFERENCES "user"(id), -- capitán
    validado_por_id     INTEGER REFERENCES "user"(id),          -- árbitro
    estado_validacion   VARCHAR(15) NOT NULL DEFAULT 'PENDIENTE',
    validado_at         TIMESTAMP,

    creado_at           TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_rol_nomina CHECK (rol_nomina IN ('TITULAR', 'SUPLENTE')),
    CONSTRAINT chk_estado_validacion CHECK (estado_validacion IN ('PENDIENTE', 'VALIDADO', 'RECHAZADO')),
    CONSTRAINT uq_partido_jugador UNIQUE (partido_id, user_id),
    CONSTRAINT uq_partido_team_dorsal UNIQUE (partido_id, team_id, dorsal)
);

CREATE INDEX idx_nominas_partido ON partido_nominas (partido_id);
