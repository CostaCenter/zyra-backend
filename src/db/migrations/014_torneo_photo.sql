ALTER TABLE torneos
  ADD COLUMN IF NOT EXISTS photo TEXT;

COMMENT ON COLUMN torneos.photo IS 'URL de foto de perfil del torneo (Cloudinary)';
