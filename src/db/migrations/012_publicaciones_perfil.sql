-- Migración 012: Publicaciones, seguidores y campos de perfil público

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS deporte_principal_id INTEGER REFERENCES sports(id);

CREATE TABLE IF NOT EXISTS publicaciones (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('FOTO', 'VIDEO')),
  url_media TEXT NOT NULL,
  caption TEXT,
  creado_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_publicaciones_user_id ON publicaciones(user_id);
CREATE INDEX IF NOT EXISTS idx_publicaciones_creado_at ON publicaciones(creado_at DESC);

CREATE TABLE IF NOT EXISTS publicacion_deportes (
  id SERIAL PRIMARY KEY,
  publicacion_id INTEGER NOT NULL REFERENCES publicaciones(id) ON DELETE CASCADE,
  sport_id INTEGER NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
  UNIQUE (publicacion_id, sport_id)
);

CREATE INDEX IF NOT EXISTS idx_publicacion_deportes_sport ON publicacion_deportes(sport_id);

CREATE TABLE IF NOT EXISTS publicacion_etiquetas (
  id SERIAL PRIMARY KEY,
  publicacion_id INTEGER NOT NULL REFERENCES publicaciones(id) ON DELETE CASCADE,
  user_id_etiquetado INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  confirmado BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (publicacion_id, user_id_etiquetado)
);

CREATE INDEX IF NOT EXISTS idx_publicacion_etiquetas_user ON publicacion_etiquetas(user_id_etiquetado);

CREATE TABLE IF NOT EXISTS seguidores (
  id SERIAL PRIMARY KEY,
  seguidor_user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  seguido_user_id INTEGER REFERENCES "user"(id) ON DELETE CASCADE,
  seguido_team_id INTEGER REFERENCES "Team"(id) ON DELETE CASCADE,
  CHECK (
    (seguido_user_id IS NOT NULL AND seguido_team_id IS NULL)
    OR (seguido_user_id IS NULL AND seguido_team_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_seguidores_usuario
  ON seguidores (seguidor_user_id, seguido_user_id)
  WHERE seguido_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_seguidores_equipo
  ON seguidores (seguidor_user_id, seguido_team_id)
  WHERE seguido_team_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_seguidores_seguido_user ON seguidores(seguido_user_id);
CREATE INDEX IF NOT EXISTS idx_seguidores_seguido_team ON seguidores(seguido_team_id);
