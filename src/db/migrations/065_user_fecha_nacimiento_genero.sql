-- Perfil de usuario: fecha de nacimiento y género (registro)
ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE,
  ADD COLUMN IF NOT EXISTS genero VARCHAR(20);

ALTER TABLE "user" DROP CONSTRAINT IF EXISTS chk_user_genero;
ALTER TABLE "user"
  ADD CONSTRAINT chk_user_genero
  CHECK (genero IS NULL OR genero IN ('MASCULINO', 'FEMENINO', 'NO_ESPECIFICADO'));
