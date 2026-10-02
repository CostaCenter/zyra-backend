-- Datos personales extendidos del atleta en nómina de división
ALTER TABLE club_division_atletas
  ADD COLUMN IF NOT EXISTS datos_personales JSONB NOT NULL DEFAULT '{}'::jsonb;
