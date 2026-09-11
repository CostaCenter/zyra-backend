-- Historias destacadas del perfil de club (tipo Instagram Highlights)

CREATE TABLE IF NOT EXISTS club_destacados (
  id SERIAL PRIMARY KEY,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  icono_portada_url TEXT,
  orden INTEGER NOT NULL DEFAULT 0,
  creado_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS club_destacado_items (
  id SERIAL PRIMARY KEY,
  destacado_id INTEGER NOT NULL REFERENCES club_destacados(id) ON DELETE CASCADE,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('IMAGEN', 'VIDEO')),
  url TEXT NOT NULL,
  duracion_segundos NUMERIC(8, 2) NOT NULL DEFAULT 5,
  orden INTEGER NOT NULL DEFAULT 0,
  creado_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_destacados_club_id ON club_destacados(club_id);
CREATE INDEX IF NOT EXISTS idx_club_destacado_items_destacado_id ON club_destacado_items(destacado_id);
