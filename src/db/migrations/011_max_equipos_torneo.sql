-- Límite opcional de equipos por torneo
ALTER TABLE torneos
ADD COLUMN IF NOT EXISTS max_equipos INTEGER;

ALTER TABLE torneos
ADD CONSTRAINT chk_max_equipos_positivo
CHECK (max_equipos IS NULL OR max_equipos >= 2);
