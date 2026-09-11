-- Clubes: organización permanente de equipos (distinto de torneos puntuales)

CREATE TABLE IF NOT EXISTS clubs (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(255) NOT NULL,
    logo_url        TEXT,
    descripcion     TEXT,
    ubicacion       VARCHAR(255),
    sport_id        INTEGER NOT NULL REFERENCES sports(id),
    admin_id        INTEGER NOT NULL REFERENCES "user"(id),
    creado_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clubs_sport ON clubs (sport_id);
CREATE INDEX idx_clubs_admin ON clubs (admin_id);

CREATE TABLE IF NOT EXISTS club_divisiones (
    id              SERIAL PRIMARY KEY,
    club_id         INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    nombre          VARCHAR(128) NOT NULL,
    genero          VARCHAR(16) NOT NULL,
    categoria_edad  VARCHAR(64),
    encargado_id    INTEGER REFERENCES "user"(id),
    creado_at       TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_club_division_genero CHECK (genero IN ('MASCULINO', 'FEMENINO', 'MIXTO'))
);

CREATE INDEX idx_club_divisiones_club ON club_divisiones (club_id);

CREATE TABLE IF NOT EXISTS club_solicitudes (
    id                  SERIAL PRIMARY KEY,
    club_id             INTEGER NOT NULL REFERENCES clubs(id),
    equipo_id           INTEGER NOT NULL REFERENCES "Team"(id),
    club_division_id    INTEGER REFERENCES club_divisiones(id),
    estado              VARCHAR(15) NOT NULL DEFAULT 'PENDIENTE',
    iniciado_por_id     INTEGER NOT NULL REFERENCES "user"(id),
    resuelto_por_id     INTEGER REFERENCES "user"(id),
    resuelto_at         TIMESTAMP,
    creado_at           TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_club_solicitud_estado CHECK (estado IN ('PENDIENTE', 'ACEPTADA', 'RECHAZADA'))
);

CREATE UNIQUE INDEX uq_club_equipo_activa
  ON club_solicitudes (club_id, equipo_id)
  WHERE estado IN ('PENDIENTE', 'ACEPTADA');

CREATE INDEX idx_club_solicitudes_club ON club_solicitudes (club_id);
CREATE INDEX idx_club_solicitudes_equipo ON club_solicitudes (equipo_id);

ALTER TABLE "Team"
  ADD COLUMN IF NOT EXISTS club_id INTEGER REFERENCES clubs(id),
  ADD COLUMN IF NOT EXISTS club_division_id INTEGER REFERENCES club_divisiones(id);

CREATE INDEX IF NOT EXISTS idx_team_club ON "Team" (club_id);

-- FK pendiente desde migración 002 (torneos.club_organizador_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_torneo_club_organizador'
  ) THEN
    ALTER TABLE torneos
      ADD CONSTRAINT fk_torneo_club_organizador
      FOREIGN KEY (club_organizador_id) REFERENCES clubs(id);
  END IF;
END $$;

-- Partidos amistosos: quién programó el encuentro (sin torneo)
ALTER TABLE partidos
  ADD COLUMN IF NOT EXISTS programado_por_id INTEGER REFERENCES "user"(id);

-- Nóminas: distinguir bando local/visitante en práctica interna (mismo team_id)
ALTER TABLE partido_nominas
  ADD COLUMN IF NOT EXISTS es_local BOOLEAN;

ALTER TABLE partido_nominas DROP CONSTRAINT IF EXISTS uq_partido_team_dorsal_set;

ALTER TABLE partido_nominas
  ADD CONSTRAINT uq_partido_team_dorsal_bando_set
  UNIQUE (partido_id, team_id, dorsal, set_numero, es_local);
