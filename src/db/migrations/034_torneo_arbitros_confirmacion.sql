-- migrations/034_torneo_arbitros_confirmacion.sql
-- Invitación con confirmación al cuerpo arbitral del torneo.

ALTER TABLE torneo_arbitros
  ADD COLUMN IF NOT EXISTS estado_confirmacion VARCHAR(12)
    CHECK (estado_confirmacion IN ('PENDIENTE', 'CONFIRMADO', 'RECHAZADO'));

UPDATE torneo_arbitros
SET estado_confirmacion = 'CONFIRMADO'
WHERE estado_confirmacion IS NULL;

ALTER TABLE torneo_arbitros
  ALTER COLUMN estado_confirmacion SET DEFAULT 'PENDIENTE';

COMMENT ON COLUMN torneo_arbitros.estado_confirmacion IS
  'Estado de invitación al cuerpo arbitral: PENDIENTE, CONFIRMADO o RECHAZADO';
