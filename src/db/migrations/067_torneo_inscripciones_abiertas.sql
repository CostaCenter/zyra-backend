-- Cierre explícito de inscripciones (independiente de iniciar el torneo)
ALTER TABLE torneos
  ADD COLUMN IF NOT EXISTS inscripciones_abiertas BOOLEAN NOT NULL DEFAULT true;

UPDATE torneos
SET inscripciones_abiertas = false
WHERE estado IN ('EN_CURSO', 'FINALIZADO', 'CANCELADO');
