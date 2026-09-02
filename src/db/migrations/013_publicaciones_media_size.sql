-- Migración 013: dimensiones de media para grid masonry

ALTER TABLE publicaciones
  ADD COLUMN IF NOT EXISTS media_width INTEGER,
  ADD COLUMN IF NOT EXISTS media_height INTEGER;
