-- Rango de edad explícito en divisiones de club
ALTER TABLE club_divisiones
  ADD COLUMN IF NOT EXISTS edad_minima SMALLINT,
  ADD COLUMN IF NOT EXISTS edad_maxima SMALLINT;

ALTER TABLE club_divisiones DROP CONSTRAINT IF EXISTS chk_club_division_edad_rango;
ALTER TABLE club_divisiones
  ADD CONSTRAINT chk_club_division_edad_rango
  CHECK (
    (edad_minima IS NULL AND edad_maxima IS NULL)
    OR (
      edad_minima IS NOT NULL
      AND edad_maxima IS NOT NULL
      AND edad_minima >= 5
      AND edad_maxima <= 99
      AND edad_minima <= edad_maxima
    )
  );
