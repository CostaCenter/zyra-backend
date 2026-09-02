-- migrations/033_arbitro_confirmacion_estado.sql
-- Estado de confirmación del árbitro asignado a un partido de torneo.

ALTER TABLE partidos
  ADD COLUMN IF NOT EXISTS arbitro_confirmacion_estado VARCHAR(12)
    CHECK (arbitro_confirmacion_estado IN ('PENDIENTE', 'CONFIRMADO', 'RECHAZADO'));

COMMENT ON COLUMN partidos.arbitro_confirmacion_estado IS
  'Confirmación del árbitro asignado: PENDIENTE, CONFIRMADO o RECHAZADO';

UPDATE partidos
SET arbitro_confirmacion_estado = 'PENDIENTE'
WHERE arbitro_asignado_id IS NOT NULL
  AND arbitro_confirmacion_estado IS NULL;
