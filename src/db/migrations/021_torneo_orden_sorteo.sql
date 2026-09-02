-- Orden del sorteo previo a generar fixture (auditable, generado en backend).
ALTER TABLE torneos
  ADD COLUMN IF NOT EXISTS orden_sorteo JSONB NOT NULL DEFAULT '{"sorteos":[]}'::jsonb;

COMMENT ON COLUMN torneos.orden_sorteo IS
  'Historial de sorteos: semilla_hex, team_ids_sorteo y metadata por fase/grupo.';
