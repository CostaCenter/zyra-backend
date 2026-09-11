-- Publicaciones asociadas a un equipo (capitán publica como equipo)
ALTER TABLE publicaciones
  ADD COLUMN IF NOT EXISTS publicado_como VARCHAR(10) NOT NULL DEFAULT 'USUARIO',
  ADD COLUMN IF NOT EXISTS equipo_id INTEGER REFERENCES "Team"(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_publicaciones_equipo_id ON publicaciones(equipo_id)
  WHERE equipo_id IS NOT NULL;

COMMENT ON COLUMN publicaciones.publicado_como IS 'USUARIO | EQUIPO';
COMMENT ON COLUMN publicaciones.equipo_id IS 'Equipo cuando publicado_como = EQUIPO';
