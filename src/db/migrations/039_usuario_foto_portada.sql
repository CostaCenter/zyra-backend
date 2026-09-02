ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS foto_portada_url TEXT NULL;

COMMENT ON COLUMN "user".foto_portada_url IS 'Imagen de portada/acción del perfil público (Cloudinary)';
