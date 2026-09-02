-- Zona en cancha (1-6) para titulares en la propuesta unificada del capitán
ALTER TABLE partido_nominas
  ADD COLUMN IF NOT EXISTS zona SMALLINT;

COMMENT ON COLUMN partido_nominas.zona IS 'Zona en cancha 1-6; obligatoria para titulares en propuesta unificada';
