-- Bio / descripción pública del equipo
ALTER TABLE "DataTeam"
  ADD COLUMN IF NOT EXISTS descripcion TEXT NULL;

COMMENT ON COLUMN "DataTeam".descripcion IS 'Descripción pública del equipo (nullable)';
