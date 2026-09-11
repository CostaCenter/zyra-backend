-- Permitir género null en divisiones (Plantel Principal genérico sin género definido)

ALTER TABLE club_divisiones DROP CONSTRAINT IF EXISTS chk_club_division_genero;

ALTER TABLE club_divisiones ALTER COLUMN genero DROP NOT NULL;

ALTER TABLE club_divisiones
  ADD CONSTRAINT chk_club_division_genero
  CHECK (genero IS NULL OR genero IN ('MASCULINO', 'FEMENINO', 'MIXTO'));

UPDATE club_divisiones
SET genero = NULL
WHERE nombre = 'Plantel Principal' AND genero = 'MIXTO';
