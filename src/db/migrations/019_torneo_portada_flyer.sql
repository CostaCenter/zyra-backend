-- Campos de portada tipo afiche para torneos
ALTER TABLE torneos
  ADD COLUMN IF NOT EXISTS imagen_portada_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS fecha_hora_inicio TIMESTAMP WITH TIME ZONE NULL,
  ADD COLUMN IF NOT EXISTS lugar VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS costo_inscripcion VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS premiacion TEXT NULL;

COMMENT ON COLUMN torneos.imagen_portada_url IS 'URL de imagen de portada (Cloudinary)';
COMMENT ON COLUMN torneos.fecha_hora_inicio IS 'Fecha y hora de inicio del torneo (informativa)';
COMMENT ON COLUMN torneos.lugar IS 'Nombre libre de la cancha o lugar';
COMMENT ON COLUMN torneos.costo_inscripcion IS 'Costo informativo; no es un cobro real';
COMMENT ON COLUMN torneos.premiacion IS 'Descripción libre de premios';
