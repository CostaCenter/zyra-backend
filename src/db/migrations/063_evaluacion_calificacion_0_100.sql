-- Escala de evaluación de rendimiento: 1-10 → 0-100

UPDATE club_evento_evaluacion_detalle
SET calificacion = calificacion * 10
WHERE calificacion BETWEEN 1 AND 10;

ALTER TABLE club_evento_evaluacion_detalle
  DROP CONSTRAINT IF EXISTS chk_calificacion_rango;

ALTER TABLE club_evento_evaluacion_detalle
  ADD CONSTRAINT chk_calificacion_rango CHECK (calificacion BETWEEN 0 AND 100);

COMMENT ON COLUMN club_evento_evaluacion_detalle.calificacion IS 'Puntaje de la métrica en escala 0-100';
