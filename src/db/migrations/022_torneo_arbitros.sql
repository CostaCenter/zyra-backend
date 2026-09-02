-- Cuerpo arbitral del torneo: árbitros de confianza por torneo.
CREATE TABLE IF NOT EXISTS torneo_arbitros (
  id            SERIAL PRIMARY KEY,
  torneo_id     INTEGER NOT NULL REFERENCES torneos(id) ON DELETE CASCADE,
  usuario_id    INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  creado_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (torneo_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_torneo_arbitros_torneo_id ON torneo_arbitros(torneo_id);
CREATE INDEX IF NOT EXISTS idx_torneo_arbitros_usuario_id ON torneo_arbitros(usuario_id);

COMMENT ON TABLE torneo_arbitros IS 'Árbitros de confianza asociados a un torneo (cuerpo arbitral).';
