-- Imagen opcional en comunicados de club (estilo feed social)
ALTER TABLE club_anuncios
  ADD COLUMN IF NOT EXISTS imagen_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS imagen_width INTEGER NULL,
  ADD COLUMN IF NOT EXISTS imagen_height INTEGER NULL;
