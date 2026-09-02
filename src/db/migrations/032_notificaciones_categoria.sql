-- Categoría de notificación (derivada del tipo al crear)

ALTER TABLE notificaciones
  ADD COLUMN IF NOT EXISTS categoria VARCHAR(50);

UPDATE notificaciones
SET categoria = 'EQUIPOS'
WHERE categoria IS NULL AND tipo = 'INVITACION_EQUIPO';

UPDATE notificaciones
SET categoria = 'TORNEOS'
WHERE categoria IS NULL AND tipo IN (
  'SOLICITUD_INSCRIPCION',
  'ASIGNACION_ARBITRO',
  'NOMINA_PROPUESTA',
  'RESULTADO_PARTIDO'
);

UPDATE notificaciones
SET categoria = 'SOCIAL'
WHERE categoria IS NULL AND tipo IN (
  'NUEVO_SEGUIDOR',
  'ETIQUETA_PENDIENTE'
);

ALTER TABLE notificaciones
  ALTER COLUMN categoria SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_categoria_created
  ON notificaciones (usuario_id, categoria, created_at DESC);

COMMENT ON COLUMN notificaciones.categoria IS 'EQUIPOS, TORNEOS, SOCIAL, RESERVAS (futuro) — derivada del tipo';
